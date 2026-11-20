import type { ComplaintStatus, ComplaintType, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type ComplaintListQuery = {
  status?: ComplaintStatus;
  type?: ComplaintType;
  q?: string;
  page?: number;
  pageSize?: number;
};

const listSelect = {
  id: true,
  referenceNumber: true,
  type: true,
  status: true,
  isDraft: true,
  description: true,
  contactName: true,
  contactEmail: true,
  acknowledgedAt: true,
  memberResponseDueAt: true,
  decisionDueAt: true,
  decidedAt: true,
  appealDeadline: true,
  outcome: true,
  createdAt: true,
  updatedAt: true,
  member: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tradingName: true,
      memberStatus: true,
    },
  },
  reviewer: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.ComplaintSelect;

function searchWhere(q: string): Prisma.ComplaintWhereInput {
  return {
    OR: [
      { referenceNumber: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { member: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { member: { is: { lastName: { contains: q, mode: "insensitive" } } } },
      { member: { is: { tradingName: { contains: q, mode: "insensitive" } } } },
    ],
  };
}

export function serializeComplaintListItem(row: Prisma.ComplaintGetPayload<{ select: typeof listSelect }>) {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    type: row.type,
    status: row.status,
    isDraft: row.isDraft,
    description: row.description,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    acknowledgedAt: row.acknowledgedAt,
    memberResponseDueAt: row.memberResponseDueAt,
    decisionDueAt: row.decisionDueAt,
    decidedAt: row.decidedAt,
    appealDeadline: row.appealDeadline,
    outcome: row.outcome,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    member: row.member,
    reviewer: row.reviewer,
  };
}

export async function listComplaints(query: ComplaintListQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim();
  const where: Prisma.ComplaintWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(q ? searchWhere(q) : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listSelect,
    }),
  ]);

  return { items: rows.map(serializeComplaintListItem), page, pageSize, total };
}

export async function getComplaintDetail(id: string) {
  const row = await prisma.complaint.findUnique({
    where: { id },
    select: {
      ...listSelect,
      contactPhone: true,
      consentAt: true,
      reasons: true,
      conflictDeclared: true,
      reviewerId: true,
      evidence: {
        orderBy: { uploadedAt: "asc" },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
        },
      },
      responses: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          memberProfileId: true,
          member: { select: { id: true, firstName: true, lastName: true, tradingName: true } },
        },
      },
      appeals: {
        orderBy: { lodgedAt: "desc" },
        select: {
          id: true,
          reason: true,
          lodgedAt: true,
          decidedAt: true,
          decision: true,
          reasons: true,
          conflictDeclared: true,
          reviewerId: true,
          reviewer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!row) return null;

  const { evidence, responses, appeals, contactPhone, consentAt, reasons, conflictDeclared, reviewerId, ...listed } = row;
  return {
    ...serializeComplaintListItem(listed),
    contactPhone,
    consentAt,
    reasons,
    conflictDeclared,
    reviewerId,
    evidence,
    responses,
    appeals,
  };
}
