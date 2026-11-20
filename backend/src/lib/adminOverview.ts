import { applicationSummary, listApplications } from "./adminApplicationQueries.js";
import { listComplaints } from "./adminComplaintQueries.js";
import { listMembers } from "./adminMemberQueries.js";
import { prisma } from "./prisma.js";

const RECENT = 8;

/**
 * Dashboard overview: aggregates existing admin list/summary queries.
 * customers/listings stay empty — Phase 1 has no those models (KG).
 * cases maps to Complaint rows so the admin UI can keep a “cases” key.
 */
export async function adminOverview() {
  const [
    summary,
    applications,
    members,
    complaints,
    memberStatusGroups,
    complaintStatusGroups,
    activeMembers,
    openComplaints,
  ] = await Promise.all([
    applicationSummary(),
    listApplications({ page: 1, pageSize: RECENT, status: undefined }),
    listMembers({ page: 1, pageSize: RECENT }),
    listComplaints({ page: 1, pageSize: RECENT }),
    prisma.memberProfile.groupBy({ by: ["memberStatus"], _count: { _all: true } }),
    prisma.complaint.groupBy({
      by: ["status"],
      where: { isDraft: false },
      _count: { _all: true },
    }),
    prisma.memberProfile.count({ where: { memberStatus: "active" } }),
    prisma.complaint.count({
      where: {
        isDraft: false,
        status: { in: ["received", "under_review", "awaiting_member_response", "under_appeal"] },
      },
    }),
  ]);

  const membersByStatus = Object.fromEntries(
    memberStatusGroups.map((row) => [row.memberStatus ?? "unknown", row._count._all]),
  ) as Record<string, number>;

  const complaintsByStatus = Object.fromEntries(
    complaintStatusGroups.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  return {
    summary: {
      ...summary,
      activeMembers,
      openComplaints,
      membersByStatus,
      complaintsByStatus,
    },
    applications: applications.items,
    members: members.items,
    /** Alias for complaints — Naledi’s overview used “cases”. */
    cases: complaints.items,
    complaints: complaints.items,
    /** Out of Phase 1 scope (no CustomerMember / ShopperProfileListing models). */
    customers: [] as const,
    listings: [] as const,
    counts: {
      applications: applications.total,
      members: members.total,
      complaints: complaints.total,
      openComplaints,
      activeMembers,
      customers: 0,
      listings: 0,
    },
  };
}
