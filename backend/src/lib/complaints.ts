import type { Complaint, ComplaintAppeal, ComplaintStatus, Prisma } from "@prisma/client";
import { conflict } from "./http.js";
import { prisma } from "./prisma.js";

/** Issues PSSA-C-YYYY-XXXX reference numbers when a complaint is submitted complete. */
export async function nextComplaintReferenceNumber(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const year = new Date().getFullYear();
  const prefix = `PSSA-C-${year}-`;
  const latest = await tx.complaint.findFirst({
    where: { referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: "desc" },
    select: { referenceNumber: true },
  });
  const next = latest?.referenceNumber ? Number(latest.referenceNumber.slice(-4)) + 1 : 1;
  if (!Number.isFinite(next) || next < 1 || next > 9999) {
    throw conflict("Could not allocate a complaint reference. Please try again.");
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

const FREE_TEXT_SUBJECT_TYPES = new Set(["impersonation", "badge_misuse"]);

/** Misconduct needs a register member; impersonation / badge_misuse may use subjectLabel instead. */
export function hasComplaintSubject(input: {
  type?: string | null;
  memberProfileId?: string | null;
  subjectLabel?: string | null;
}) {
  if (input.memberProfileId) return true;
  return Boolean(input.type && FREE_TEXT_SUBJECT_TYPES.has(input.type) && input.subjectLabel?.trim());
}

export function isComplaintComplete(input: {
  type?: string | null;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  consentAt?: Date | null;
  memberProfileId?: string | null;
  subjectLabel?: string | null;
}) {
  return Boolean(
    input.type &&
      input.description?.trim() &&
      input.contactName?.trim() &&
      input.contactEmail?.trim() &&
      input.consentAt &&
      hasComplaintSubject(input),
  );
}

export function nextStepsForStatus(status: ComplaintStatus) {
  switch (status) {
    case "received":
      return "Your report has been received. PSSA aims to acknowledge it within two business days.";
    case "under_review":
      return "A reviewer is working on this case.";
    case "awaiting_member_response":
      return "The member has been asked to respond. PSSA is waiting for that reply.";
    case "decided":
      return "An outcome has been recorded. An appeal may be lodged before the appeal deadline if you disagree.";
    case "under_appeal":
      return "An appeal is being reviewed by a different person.";
    default:
      return "Your report is on file with PSSA.";
  }
}

/** Public-safe complaint payload — no evidence files, IDs, or private addresses. */
export function serializePublicComplaint(
  complaint: Pick<
    Complaint,
    | "id"
    | "referenceNumber"
    | "type"
    | "status"
    | "description"
    | "subjectLabel"
    | "isDraft"
    | "acknowledgedAt"
    | "memberResponseDueAt"
    | "decisionDueAt"
    | "decidedAt"
    | "appealDeadline"
    | "outcome"
    | "createdAt"
    | "updatedAt"
  > & {
    member?: { firstName: string; lastName: string; tradingName: string | null } | null;
    appeals?: Array<Pick<ComplaintAppeal, "id" | "lodgedAt" | "decidedAt" | "decision">>;
    _count?: { evidence: number; responses: number };
  },
) {
  return {
    id: complaint.id,
    referenceNumber: complaint.referenceNumber,
    type: complaint.type,
    status: complaint.status,
    isDraft: complaint.isDraft,
    description: complaint.description,
    subjectLabel: complaint.subjectLabel,
    acknowledgedAt: complaint.acknowledgedAt,
    memberResponseDueAt: complaint.memberResponseDueAt,
    decisionDueAt: complaint.decisionDueAt,
    decidedAt: complaint.decidedAt,
    appealDeadline: complaint.appealDeadline,
    outcome: complaint.outcome,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    nextSteps: nextStepsForStatus(complaint.status),
    member: complaint.member
      ? {
          firstName: complaint.member.firstName,
          lastName: complaint.member.lastName,
          tradingName: complaint.member.tradingName,
        }
      : null,
    evidenceCount: complaint._count?.evidence ?? 0,
    responseCount: complaint._count?.responses ?? 0,
    appeals: (complaint.appeals ?? []).map((appeal) => ({
      id: appeal.id,
      lodgedAt: appeal.lodgedAt,
      decidedAt: appeal.decidedAt,
      decision: appeal.decision,
    })),
  };
}

export async function findMemberForComplaint(lookup: {
  memberProfileId?: string | null;
  certificateNumber?: string | null;
}) {
  if (lookup.memberProfileId) {
    return prisma.memberProfile.findUnique({
      where: { id: lookup.memberProfileId },
      select: { id: true, firstName: true, lastName: true, tradingName: true },
    });
  }
  if (lookup.certificateNumber) {
    const number = lookup.certificateNumber.trim().toUpperCase().replace(/\s+/g, "");
    const cert = await prisma.certificate.findUnique({
      where: { number },
      select: {
        member: { select: { id: true, firstName: true, lastName: true, tradingName: true } },
      },
    });
    return cert?.member ?? null;
  }
  return null;
}
