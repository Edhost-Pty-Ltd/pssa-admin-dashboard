import type { MemberStatus, Prisma } from "@prisma/client";
import { liveCertificateStatus, serializePublicCertificate, type CertificateRow } from "./certificates.js";
import { prisma } from "./prisma.js";

export type PublicRegisterQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
};

/** Anyone with a stored membership status can appear; live status is derived (never fake Active). */
const PUBLIC_STATUSES: MemberStatus[] = ["active", "suspended", "expired", "revoked", "resigned"];

function normalizeCertificateNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function publicVisibilityWhere(): Prisma.MemberProfileWhereInput {
  return {
    memberStatus: { in: PUBLIC_STATUSES },
    certificates: { some: {} },
  };
}

function searchWhere(q?: string): Prisma.MemberProfileWhereInput {
  const term = q?.trim();
  if (!term) return publicVisibilityWhere();

  const cert = normalizeCertificateNumber(term);
  const parts = term.split(/\s+/).filter(Boolean);
  const nameClauses: Prisma.MemberProfileWhereInput[] =
    parts.length >= 2
      ? [
          {
            AND: [
              { firstName: { contains: parts[0], mode: "insensitive" } },
              { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
            ],
          },
          {
            AND: [
              { firstName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
              { lastName: { contains: parts[0], mode: "insensitive" } },
            ],
          },
        ]
      : [];

  return {
    AND: [
      publicVisibilityWhere(),
      {
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { tradingName: { contains: term, mode: "insensitive" } },
          { certificates: { some: { number: { equals: cert, mode: "insensitive" } } } },
          { certificates: { some: { number: { contains: cert, mode: "insensitive" } } } },
          ...nameClauses,
        ],
      },
    ],
  };
}

const listSelect = {
  id: true,
  firstName: true,
  lastName: true,
  tradingName: true,
  scope: true,
  memberStatus: true,
  validUntil: true,
  channels: { where: { status: "confirmed" as const }, select: { kind: true, value: true } },
  certificates: {
    orderBy: { issuedAt: "desc" as const },
    take: 1,
    select: {
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
    },
  },
} satisfies Prisma.MemberProfileSelect;

type ListRow = Prisma.MemberProfileGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow, now = new Date()) {
  const certificate = row.certificates[0] ?? null;
  if (!certificate) return null;
  const validUntil = row.validUntil ?? certificate.validUntil;
  const status = liveCertificateStatus(
    { memberStatus: row.memberStatus, validUntil },
    certificate,
    now,
  );
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    tradingName: row.tradingName,
    scope: certificate.scope ?? row.scope,
    number: certificate.number,
    /** Live status (same rules as /api/verify). */
    status,
    /** Alias for older frontend RegisterMember typing. */
    memberStatus: status,
    validUntil,
    channels: row.channels.map((channel) => ({ kind: channel.kind, value: channel.value })),
  };
}

/** Public register list. Pending applicants (no membership / no certificate) are omitted. */
export async function searchPublicMembers(query: PublicRegisterQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const where = searchWhere(query.q);
  const now = new Date();

  const [total, rows] = await prisma.$transaction([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listSelect,
    }),
  ]);

  const items = rows.map((row) => toListItem(row, now)).filter((item): item is NonNullable<typeof item> => item !== null);
  return { items, page, pageSize, total };
}

const detailSelect = {
  id: true,
  firstName: true,
  lastName: true,
  tradingName: true,
  scope: true,
  memberStatus: true,
  validUntil: true,
  channels: { where: { status: "confirmed" as const }, select: { kind: true, value: true, status: true } },
  certificates: {
    orderBy: { issuedAt: "desc" as const },
    take: 1,
    select: {
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
    },
  },
} satisfies Prisma.MemberProfileSelect;

/**
 * One public profile by MemberProfile id or certificate number.
 * Returns the live-check `{ certificate }` payload, or null if not publicly visible.
 */
export async function publicMemberCertificate(ref: string) {
  const raw = ref.trim();
  if (!raw) return null;

  const certNumber = normalizeCertificateNumber(raw);
  const looksLikeCert = /^PSSA-\d{4}-\d{6}$/i.test(certNumber);

  const row = await prisma.memberProfile.findFirst({
    where: {
      AND: [
        publicVisibilityWhere(),
        looksLikeCert
          ? { certificates: { some: { number: { equals: certNumber, mode: "insensitive" } } } }
          : {
              OR: [
                { id: raw },
                { certificates: { some: { number: { equals: certNumber, mode: "insensitive" } } } },
              ],
            },
      ],
    },
    select: detailSelect,
  });
  if (!row?.certificates[0]) return null;

  const certificate = row.certificates[0] as CertificateRow;
  return serializePublicCertificate({
    certificate,
    profile: row,
    channels: row.channels,
  });
}
