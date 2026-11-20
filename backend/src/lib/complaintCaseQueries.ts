import type { ComplaintStatus, ComplaintType, MemberStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type ComplaintCaseListQuery = {
  status?: ComplaintStatus;
  type?: ComplaintType;
  q?: string;
  page?: number;
  pageSize?: number;
};

const STATUSES = ["received", "under_review", "awaiting_member_response", "decided", "under_appeal"] as const satisfies readonly ComplaintStatus[];
const TYPES = ["misconduct", "impersonation", "badge_misuse"] as const satisfies readonly ComplaintType[];

function searchWhere(q: string): Prisma.ComplaintWhereInput {
  return {
    OR: [
      { referenceNumber: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { subjectLabel: { contains: q, mode: "insensitive" } },
      { member: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { member: { is: { lastName: { contains: q, mode: "insensitive" } } } },
      { member: { is: { tradingName: { contains: q, mode: "insensitive" } } } },
      { member: { is: { certificates: { some: { number: { contains: q, mode: "insensitive" } } } } } },
    ],
  };
}

function shownMemberStatus(memberStatus: MemberStatus | null, validUntil: Date | null, now: Date) {
  if (!memberStatus) return null;
  if (memberStatus === "suspended" || memberStatus === "revoked" || memberStatus === "resigned") return memberStatus;
  if (validUntil && validUntil.getTime() <= now.getTime()) return "expired";
  return memberStatus;
}

const listSelect = {
  id: true,
  referenceNumber: true,
  type: true,
  status: true,
  outcome: true,
  isDraft: true,
  contactName: true,
  subjectLabel: true,
  createdAt: true,
  acknowledgedAt: true,
  memberResponseDueAt: true,
  decisionDueAt: true,
  appealDeadline: true,
  decidedAt: true,
  responses: { select: { id: true }, take: 1 },
  member: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tradingName: true,
      memberStatus: true,
      validUntil: true,
      certificates: { orderBy: { issuedAt: "desc" as const }, take: 1, select: { number: true } },
    },
  },
  reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.ComplaintSelect;

type ListRow = Prisma.ComplaintGetPayload<{ select: typeof listSelect }>;

function personName(person: { firstName: string | null; lastName: string | null }) {
  return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
}

function deadlines(row: { acknowledgedAt: Date | null; memberResponseDueAt: Date | null; decisionDueAt: Date | null; appealDeadline: Date | null; decidedAt: Date | null; responses?: { id: string }[] }, now: Date) {
  const responseOverdue = !!row.memberResponseDueAt && row.memberResponseDueAt.getTime() < now.getTime() && (row.responses?.length ?? 0) === 0;
  const decisionOverdue = !row.decidedAt && !!row.decisionDueAt && row.decisionDueAt.getTime() < now.getTime();
  return {
    acknowledgedAt: row.acknowledgedAt,
    memberResponseDueAt: row.memberResponseDueAt,
    decisionDueAt: row.decisionDueAt,
    appealDeadline: row.appealDeadline,
    responseOverdue,
    decisionOverdue,
  };
}

function toListItem(row: ListRow, now: Date) {
  const member = row.member;
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    type: row.type,
    status: row.status,
    outcome: row.outcome,
    isDraft: row.isDraft,
    contactName: row.contactName,
    subjectLabel: row.subjectLabel,
    createdAt: row.createdAt,
    member: member
      ? {
          id: member.id,
          name: personName(member),
          tradingName: member.tradingName,
          number: member.certificates[0]?.number ?? null,
          status: shownMemberStatus(member.memberStatus, member.validUntil, now),
        }
      : null,
    reviewer: row.reviewer ? { id: row.reviewer.id, name: personName(row.reviewer), email: row.reviewer.email } : null,
    deadlines: deadlines(row, now),
  };
}

/** Admin case list. Drafts stay visible to the reviewer. */
export async function listComplaintCases(query: ComplaintCaseListQuery, now = new Date()) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
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

  return { items: rows.map((row) => toListItem(row, now)), page, pageSize, total, statuses: STATUSES, types: TYPES };
}

/** One case for the admin detail screen. Null means the id is unknown. */
export async function complaintCase(id: string, now = new Date()) {
  const row = await prisma.complaint.findUnique({
    where: { id },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tradingName: true,
          memberStatus: true,
          validUntil: true,
          certificates: { orderBy: { issuedAt: "desc" }, take: 1, select: { number: true } },
        },
      },
      reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      evidence: { orderBy: { uploadedAt: "asc" } },
      responses: { orderBy: { createdAt: "asc" }, include: { member: { select: { id: true, firstName: true, lastName: true } } } },
      appeals: { orderBy: { lodgedAt: "asc" }, include: { reviewer: { select: { id: true, firstName: true, lastName: true, email: true } } } },
    },
  });
  if (!row) return null;

  const timeline = [
    { at: row.createdAt, kind: row.isDraft ? "draft_saved" : "received" },
    ...(row.acknowledgedAt ? [{ at: row.acknowledgedAt, kind: "acknowledged" }] : []),
    ...row.responses.map((response) => ({ at: response.createdAt, kind: "member_response" })),
    ...(row.decidedAt ? [{ at: row.decidedAt, kind: "decided" }] : []),
    ...row.appeals.flatMap((appeal) => [{ at: appeal.lodgedAt, kind: "appeal_lodged" }, ...(appeal.decidedAt ? [{ at: appeal.decidedAt, kind: "appeal_decided" }] : [])]),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    type: row.type,
    status: row.status,
    outcome: row.outcome,
    isDraft: row.isDraft,
    description: row.description,
    subjectLabel: row.subjectLabel,
    reasons: row.reasons,
    conflictDeclared: row.conflictDeclared,
    parties: {
      complainant: { name: row.contactName, email: row.contactEmail, phone: row.contactPhone, consentAt: row.consentAt },
      subjectLabel: row.subjectLabel,
      member: row.member
        ? {
            id: row.member.id,
            name: personName(row.member),
            tradingName: row.member.tradingName,
            number: row.member.certificates[0]?.number ?? null,
            status: shownMemberStatus(row.member.memberStatus, row.member.validUntil, now),
          }
        : null,
      reviewer: row.reviewer ? { id: row.reviewer.id, name: personName(row.reviewer), email: row.reviewer.email } : null,
    },
    deadlines: deadlines(row, now),
    evidence: row.evidence.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.uploadedAt,
    })),
    responses: row.responses.map((response) => ({
      id: response.id,
      body: response.body,
      createdAt: response.createdAt,
      member: { id: response.member.id, name: personName(response.member) },
    })),
    appeals: row.appeals.map((appeal) => ({
      id: appeal.id,
      reason: appeal.reason,
      lodgedAt: appeal.lodgedAt,
      decidedAt: appeal.decidedAt,
      decision: appeal.decision,
      reasons: appeal.reasons,
      conflictDeclared: appeal.conflictDeclared,
      reviewer: appeal.reviewer ? { id: appeal.reviewer.id, name: personName(appeal.reviewer), email: appeal.reviewer.email } : null,
    })),
    timeline,
  };
}