import type { MemberStatus, Prisma } from "@prisma/client";
import { liveCertificateStatus, serializeCertificate } from "./certificates.js";
import { prisma } from "./prisma.js";

export type MemberListQuery = {
  status?: MemberStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

const memberListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  tradingName: true,
  scope: true,
  memberStatus: true,
  validFrom: true,
  validUntil: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true } },
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

function searchWhere(q: string): Prisma.MemberProfileWhereInput {
  return {
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { tradingName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { user: { is: { email: { contains: q, mode: "insensitive" } } } },
      { certificates: { some: { number: { contains: q, mode: "insensitive" } } } },
    ],
  };
}

function serializeListedMember(row: Prisma.MemberProfileGetPayload<{ select: typeof memberListSelect }>) {
  const certificate = row.certificates[0] ?? null;
  return {
    id: row.id,
    userId: row.user.id,
    email: row.user.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    tradingName: row.tradingName,
    scope: row.scope,
    memberStatus: row.memberStatus,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    certificate: certificate
      ? serializeCertificate(certificate, liveCertificateStatus(row, certificate))
      : null,
  };
}

/** Paginated member directory for the admin Members screen. */
export async function listMembers(query: MemberListQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim();
  const where: Prisma.MemberProfileWhereInput = {
    ...(query.status ? { memberStatus: query.status } : {}),
    ...(q ? searchWhere(q) : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: memberListSelect,
    }),
  ]);

  return { items: rows.map(serializeListedMember), page, pageSize, total };
}

export async function getMemberDetail(memberProfileId: string) {
  const row = await prisma.memberProfile.findUnique({
    where: { id: memberProfileId },
    select: {
      ...memberListSelect,
      physicalAddress: true,
      city: true,
      identityType: true,
      channels: {
        select: { id: true, kind: true, value: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          conflictDeclared: true,
          createdAt: true,
          actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!row) return null;

  const { statusHistory, physicalAddress, city, identityType, channels, ...listed } = row;
  return {
    ...serializeListedMember(listed),
    physicalAddress,
    city,
    identityType,
    channels,
    history: statusHistory.map((entry) => ({
      id: entry.id,
      from: entry.fromStatus,
      to: entry.toStatus,
      reason: entry.reason,
      conflictDeclared: entry.conflictDeclared,
      at: entry.createdAt,
      actor: entry.actor,
    })),
  };
}

export async function listMemberHistory(memberProfileId: string) {
  const exists = await prisma.memberProfile.findUnique({
    where: { id: memberProfileId },
    select: { id: true },
  });
  if (!exists) return null;

  const history = await prisma.statusHistory.findMany({
    where: { memberProfileId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      conflictDeclared: true,
      createdAt: true,
      actor: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  return history.map((entry) => ({
    id: entry.id,
    from: entry.fromStatus,
    to: entry.toStatus,
    reason: entry.reason,
    conflictDeclared: entry.conflictDeclared,
    at: entry.createdAt,
    actor: entry.actor,
  }));
}

export async function listAuditLog(query: { q?: string; page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim();
  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
          { reason: { contains: q, mode: "insensitive" } },
          { actor: { is: { email: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        conflictDeclared: true,
        createdAt: true,
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      reason: row.reason,
      conflictDeclared: row.conflictDeclared,
      at: row.createdAt,
      actor: row.actor,
    })),
    page,
    pageSize,
    total,
  };
}
