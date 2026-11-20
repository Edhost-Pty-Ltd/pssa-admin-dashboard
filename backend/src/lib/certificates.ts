import type { Certificate, Channel, MemberProfile, Prisma } from "@prisma/client";
import { conflict } from "./http.js";
import { prisma } from "./prisma.js";

export type PublicMembershipStatus = "active" | "suspended" | "expired" | "revoked" | "resigned";

const certificateSelect = {
  id: true,
  number: true,
  issuedAt: true,
  validFrom: true,
  validUntil: true,
  scope: true,
  qrTargetUrl: true,
  status: true,
  pdfPath: true,
  createdAt: true,
} as const;

export type CertificateRow = Prisma.CertificateGetPayload<{ select: typeof certificateSelect }>;

/** Issues PSSA-YYYY-XXXXXX certificate numbers. */
export async function nextCertificateNumber(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const year = new Date().getFullYear();
  const prefix = `PSSA-${year}-`;
  const latest = await tx.certificate.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const next = latest ? Number(latest.number.slice(-6)) + 1 : 1;
  if (!Number.isFinite(next) || next < 1 || next > 999999) {
    throw conflict("Could not allocate a certificate number. Please try again.");
  }
  return `${prefix}${String(next).padStart(6, "0")}`;
}

/**
 * Live public status — derived from the member profile and validity dates so an
 * expired / suspended / revoked / resigned member is never shown as active even
 * if a background job failed to update Certificate.status.
 */
export function liveCertificateStatus(
  profile: Pick<MemberProfile, "memberStatus" | "validUntil">,
  certificate: Pick<Certificate, "status" | "validUntil">,
  now = new Date(),
): PublicMembershipStatus {
  const memberStatus = profile.memberStatus;
  if (memberStatus === "revoked" || certificate.status === "revoked") return "revoked";
  if (memberStatus === "resigned" || certificate.status === "resigned") return "resigned";
  if (memberStatus === "suspended") return "suspended";

  const validUntil = profile.validUntil ?? certificate.validUntil;
  if (
    memberStatus === "expired" ||
    certificate.status === "expired" ||
    (validUntil && validUntil.getTime() < now.getTime())
  ) {
    return "expired";
  }

  if (memberStatus === "active" && certificate.status === "active") return "active";
  return "expired";
}

export function serializeCertificate(certificate: CertificateRow, liveStatus: PublicMembershipStatus) {
  return {
    id: certificate.id,
    number: certificate.number,
    issuedAt: certificate.issuedAt,
    validFrom: certificate.validFrom,
    validUntil: certificate.validUntil,
    scope: certificate.scope,
    qrTargetUrl: certificate.qrTargetUrl,
    status: liveStatus,
    storedStatus: certificate.status,
    hasPdf: Boolean(certificate.pdfPath),
  };
}

/** Public live-check payload — matches Tshepang’s CertificateCheck shape. */
export function serializePublicCertificate(input: {
  certificate: CertificateRow;
  profile: Pick<MemberProfile, "firstName" | "lastName" | "tradingName" | "scope" | "memberStatus" | "validUntil">;
  channels: Array<Pick<Channel, "kind" | "value" | "status">>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const status = liveCertificateStatus(input.profile, input.certificate, now);
  const validUntil = input.profile.validUntil ?? input.certificate.validUntil;
  return {
    number: input.certificate.number,
    firstName: input.profile.firstName,
    lastName: input.profile.lastName,
    tradingName: input.profile.tradingName,
    scope: input.certificate.scope ?? input.profile.scope,
    status,
    validFrom: input.certificate.validFrom,
    validUntil,
    channels: input.channels
      .filter((channel) => channel.status === "confirmed")
      .map((channel) => ({ kind: channel.kind, value: channel.value })),
    checkedAt: now.toISOString(),
  };
}

/** Create a certificate when membership becomes Active. Reuses an existing active row if present. */
export async function issueCertificateOnActivation(
  tx: Prisma.TransactionClient,
  input: {
    memberProfileId: string;
    scope: string | null;
    validFrom: Date;
    validUntil: Date;
    issuedById: string;
  },
) {
  const existing = await tx.certificate.findFirst({
    where: { memberProfileId: input.memberProfileId, status: "active" },
    orderBy: { issuedAt: "desc" },
    select: certificateSelect,
  });
  if (existing) {
    return tx.certificate.update({
      where: { id: existing.id },
      data: {
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        scope: input.scope,
        issuedById: input.issuedById,
      },
      select: certificateSelect,
    });
  }

  const number = await nextCertificateNumber(tx);
  return tx.certificate.create({
    data: {
      number,
      memberProfileId: input.memberProfileId,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      scope: input.scope,
      qrTargetUrl: `/verify/${number}`,
      status: "active",
      issuedById: input.issuedById,
    },
    select: certificateSelect,
  });
}

export async function findCertificateForMember(memberProfileId: string) {
  return prisma.certificate.findFirst({
    where: { memberProfileId },
    orderBy: { issuedAt: "desc" },
    select: certificateSelect,
  });
}

export async function findCertificateByNumber(number: string) {
  return prisma.certificate.findUnique({
    where: { number },
    select: {
      ...certificateSelect,
      member: {
        select: {
          firstName: true,
          lastName: true,
          tradingName: true,
          scope: true,
          memberStatus: true,
          validUntil: true,
          channels: {
            where: { status: "confirmed" },
            select: { kind: true, value: true, status: true },
          },
        },
      },
    },
  });
}
