import type { MemberStatus, Prisma, Renewal, RenewalStatus } from "@prisma/client";
import { hasPassedRefresherExam } from "./examReviewQueries.js";
import { conflict } from "./http.js";
import { prisma } from "./prisma.js";

/** Renewal window opens this many calendar days before validUntil. */
export const RENEWAL_WINDOW_DAYS = 60;
export const MEMBERSHIP_MONTHS = 12;

const renewalSelect = {
  id: true,
  memberProfileId: true,
  status: true,
  windowOpensAt: true,
  startedAt: true,
  submittedAt: true,
  declarationAcceptedAt: true,
  declarationVersion: true,
  declarationStatements: true,
  decisionReason: true,
  conflictDeclared: true,
  reviewerId: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type RenewalRow = Prisma.RenewalGetPayload<{ select: typeof renewalSelect }>;

export function serializeRenewal(renewal: RenewalRow) {
  return {
    id: renewal.id,
    memberProfileId: renewal.memberProfileId,
    status: renewal.status,
    windowOpensAt: renewal.windowOpensAt,
    startedAt: renewal.startedAt,
    submittedAt: renewal.submittedAt,
    declarationAcceptedAt: renewal.declarationAcceptedAt,
    declarationVersion: renewal.declarationVersion,
    declarationStatements: renewal.declarationStatements,
    decisionReason: renewal.decisionReason,
    conflictDeclared: renewal.conflictDeclared,
    reviewerId: renewal.reviewerId,
    decidedAt: renewal.decidedAt,
    createdAt: renewal.createdAt,
    updatedAt: renewal.updatedAt,
  };
}

export function renewalWindowOpensAt(validUntil: Date) {
  const opens = new Date(validUntil);
  opens.setUTCDate(opens.getUTCDate() - RENEWAL_WINDOW_DAYS);
  return opens;
}

/** Extend from the later of now or current validUntil so early renewals don’t shorten the term. */
export function nextValidUntil(currentValidUntil: Date | null, now = new Date()) {
  const base = currentValidUntil && currentValidUntil.getTime() > now.getTime() ? new Date(currentValidUntil) : new Date(now);
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + MEMBERSHIP_MONTHS);
  return next;
}

export function canStartRenewal(input: {
  memberStatus: MemberStatus | null;
  validUntil: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.validUntil) {
    return { ok: false as const, reason: "Membership has not been activated yet." };
  }
  if (input.memberStatus === "revoked" || input.memberStatus === "resigned") {
    return { ok: false as const, reason: "Revoked or resigned members cannot renew." };
  }
  if (input.memberStatus === "suspended") {
    return { ok: false as const, reason: "Suspended members cannot renew until the suspension is lifted." };
  }
  const windowOpensAt = renewalWindowOpensAt(input.validUntil);
  if (now.getTime() < windowOpensAt.getTime()) {
    return { ok: false as const, reason: "The renewal window has not opened yet.", windowOpensAt };
  }
  return { ok: true as const, windowOpensAt };
}

const OPEN_STATUSES: RenewalStatus[] = ["draft", "submitted", "needs_info"];

export async function findOpenRenewal(memberProfileId: string) {
  return prisma.renewal.findFirst({
    where: { memberProfileId, status: { in: OPEN_STATUSES } },
    orderBy: { startedAt: "desc" },
    select: renewalSelect,
  });
}

export async function findRenewalById(id: string) {
  return prisma.renewal.findUnique({
    where: { id },
    select: {
      ...renewalSelect,
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tradingName: true,
          scope: true,
          memberStatus: true,
          validFrom: true,
          validUntil: true,
          userId: true,
          user: { select: { id: true, email: true } },
          certificates: {
            orderBy: { issuedAt: "desc" },
            take: 1,
            select: {
              id: true,
              number: true,
              status: true,
              validFrom: true,
              validUntil: true,
              scope: true,
              qrTargetUrl: true,
              pdfPath: true,
              issuedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

async function documentsAccepted(userId: string) {
  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { type: true, status: true },
  });
  const latest = new Map<string, string>();
  for (const doc of documents) {
    if (!latest.has(doc.type)) latest.set(doc.type, doc.status);
  }
  const accepted = (type: string) => latest.get(type) === "accepted";
  const hasId = accepted("id_document");
  const hasAddressOrBiz = accepted("proof_of_residence") || accepted("business_registration");
  const hasBank = accepted("bank_evidence");
  return hasId && hasAddressOrBiz && hasBank;
}

export async function buildRenewalChecklist(input: {
  memberProfileId: string;
  userId: string;
  renewal: Pick<Renewal, "declarationAcceptedAt" | "declarationVersion" | "startedAt" | "windowOpensAt"> | null;
  /** When no open renewal yet, count a refresher passed since the renewal window opened. */
  windowOpensAt?: Date | null;
}) {
  const refresherSince = input.renewal?.startedAt ?? input.renewal?.windowOpensAt ?? input.windowOpensAt ?? null;
  const [docsOk, refresherPassed] = await Promise.all([
    documentsAccepted(input.userId),
    hasPassedRefresherExam(input.memberProfileId, refresherSince),
  ]);
  const declarationOk = Boolean(input.renewal?.declarationAcceptedAt && input.renewal.declarationVersion);

  return [
    {
      key: "documents" as const,
      label: "Verification documents",
      complete: docsOk,
      detail: docsOk
        ? "Required verification documents are accepted"
        : "ID, address/registration and bank evidence must be accepted",
    },
    {
      key: "refresher" as const,
      label: "Refresher assessment",
      complete: refresherPassed,
      detail: refresherPassed
        ? "Refresher assessment passed for this renewal cycle"
        : "Pass the refresher assessment (POST /api/exam/start with type refresher) before renewal approval",
    },
    {
      key: "declaration" as const,
      label: "Annual declaration",
      complete: declarationOk,
      detail: declarationOk ? "Annual declaration accepted" : "Accept the annual declaration to submit",
    },
  ];
}

export async function getMemberRenewalStatus(input: {
  memberProfileId: string;
  userId: string;
  memberStatus: MemberStatus | null;
  validUntil: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const open = await findOpenRenewal(input.memberProfileId);
  const windowOpensAt = input.validUntil ? renewalWindowOpensAt(input.validUntil) : null;
  const eligibility = canStartRenewal({
    memberStatus: input.memberStatus,
    validUntil: input.validUntil,
    now,
  });

  let status: RenewalStatus | "not_started" | "window_closed" | "ineligible" = "not_started";
  if (open) status = open.status;
  else if (!input.validUntil || input.memberStatus === "revoked" || input.memberStatus === "resigned" || input.memberStatus === "suspended") {
    status = "ineligible";
  } else if (!eligibility.ok) {
    status = "window_closed";
  }

  const checklist = await buildRenewalChecklist({
    memberProfileId: input.memberProfileId,
    userId: input.userId,
    renewal: open,
    windowOpensAt,
  });

  return {
    validUntil: input.validUntil,
    windowOpensAt: open?.windowOpensAt ?? windowOpensAt,
    status,
    checklist,
    lastReminderAt: null as string | null,
    renewal: open ? serializeRenewal(open) : null,
    canStart: eligibility.ok && !open,
  };
}

export async function startRenewal(memberProfileId: string, windowOpensAt: Date) {
  const existing = await findOpenRenewal(memberProfileId);
  if (existing) throw conflict("A renewal is already in progress.", { renewal: serializeRenewal(existing) });

  const renewal = await prisma.renewal.create({
    data: {
      memberProfileId,
      status: "draft",
      windowOpensAt,
    },
    select: renewalSelect,
  });
  return serializeRenewal(renewal);
}
