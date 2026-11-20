import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

const STATUSES = ["draft", "submitted", "under_review", "needs_info", "approved", "rejected"] as const satisfies readonly ApplicationStatus[];

export type ApplicationListQuery = {
  status?: ApplicationStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function searchWhere(q: string): Prisma.ApplicationWhereInput {
  return {
    OR: [
      { number: { contains: q, mode: "insensitive" } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { memberProfile: { is: { tradingName: { contains: q, mode: "insensitive" } } } } },
      { user: { memberProfile: { is: { firstName: { contains: q, mode: "insensitive" } } } } },
      { user: { memberProfile: { is: { lastName: { contains: q, mode: "insensitive" } } } } },
    ],
  };
}

/** List, search, status filter and pagination for the admin Applications screen. */
export async function listApplications(query: ApplicationListQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const q = query.q?.trim();
  const where: Prisma.ApplicationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(q ? searchWhere(q) : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        number: true,
        status: true,
        submittedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            memberProfile: { select: { firstName: true, lastName: true, tradingName: true } },
            documents: { select: { status: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => {
      const profile = row.user.memberProfile;
      return {
        id: row.id,
        number: row.number,
        status: row.status,
        submittedAt: row.submittedAt,
        applicant: {
          firstName: profile?.firstName || row.user.firstName,
          lastName: profile?.lastName || row.user.lastName,
          email: row.user.email,
          tradingName: profile?.tradingName ?? null,
        },
        documents: {
          accepted: row.user.documents.filter((document) => document.status === "accepted").length,
          total: row.user.documents.length,
        },
      };
    }),
    page,
    pageSize,
    total,
  };
}

/** Tiles: awaiting review, needs information, average review time, approval rate. */
export async function applicationSummary() {
  const since = new Date(Date.now() - NINETY_DAYS_MS);
  const [awaitingReview, needsInformation, reviewed, decisions] = await Promise.all([
    prisma.application.count({ where: { status: { in: ["submitted", "under_review"] } } }),
    prisma.application.count({ where: { status: "needs_info" } }),
    prisma.application.findMany({
      where: { submittedAt: { not: null }, reviews: { some: {} } },
      select: {
        submittedAt: true,
        reviews: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.adminReview.groupBy({
      by: ["decision"],
      where: { createdAt: { gte: since }, decision: { in: ["approved", "rejected"] } },
      _count: { _all: true },
    }),
  ]);

  const durations = reviewed.flatMap((application) => {
    const submittedAt = application.submittedAt;
    const reviewedAt = application.reviews[0]?.createdAt;
    if (!submittedAt || !reviewedAt) return [];
    return [(reviewedAt.getTime() - submittedAt.getTime()) / (24 * 60 * 60 * 1000)];
  });
  const approved = decisions.find((row) => row.decision === "approved")?._count._all ?? 0;
  const rejected = decisions.find((row) => row.decision === "rejected")?._count._all ?? 0;
  const decided = approved + rejected;

  return {
    awaitingReview,
    needsInformation,
    averageReviewTimeDays: durations.length ? Math.round((durations.reduce((sum, days) => sum + days, 0) / durations.length) * 10) / 10 : null,
    approvalRate: decided ? Math.round((approved / decided) * 100) : null,
    statuses: STATUSES,
  };
}