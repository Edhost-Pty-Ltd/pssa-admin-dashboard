import { Router } from "express";
import { z } from "zod";
import { existsSync } from "node:fs";
import { getComplaintDetail, listComplaints } from "../lib/adminComplaintQueries.js";
import { addBusinessDays } from "../lib/businessDays.js";
import { conflict, forbidden, notFound } from "../lib/http.js";
import { applyPrivateFileHeaders, logPrivateFileAccess } from "../lib/privateFiles.js";
import { notifyComplaintAppealDecision, notifyComplaintDecision, notifyMemberStatusChange } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { privateFilePath } from "../lib/uploads.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Admin complaints queue on KG’s Complaint models.
 * Extends /api/admin; does not invent a parallel cases system.
 */
export const adminComplaintsRouter = Router();
adminComplaintsRouter.use(requireRole("ADMIN"));

const listSchema = z.object({
  status: z.enum(["received", "under_review", "awaiting_member_response", "decided", "under_appeal"]).optional(),
  type: z.enum(["misconduct", "impersonation", "badge_misuse"]).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const patchSchema = z
  .object({
    status: z.enum(["received", "under_review", "awaiting_member_response", "decided", "under_appeal"]).optional(),
    assigneeId: z.string().trim().min(1).nullable().optional(),
    internalNote: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: "Provide at least one field to update.",
  });

const decisionSchema = z.object({
  outcome: z.enum(["no_breach", "corrective_action", "suspension", "revocation"]),
  reasons: z.string().trim().min(10, "must be at least 10 characters"),
  conflictDeclared: z.literal(true, { error: "conflict declaration is required" }),
});

const appealDecisionSchema = z.object({
  decision: z.string().trim().min(1, "is required").max(100),
  reasons: z.string().trim().min(10, "must be at least 10 characters"),
  conflictDeclared: z.literal(true, { error: "conflict declaration is required" }),
});

adminComplaintsRouter.get("/complaints", async (req, res) => {
  const query = listSchema.parse(req.query);
  res.json(await listComplaints(query));
});

adminComplaintsRouter.get("/complaints/:id", async (req, res) => {
  const complaint = await getComplaintDetail(String(req.params.id));
  if (!complaint) throw notFound("Complaint not found.");
  res.json({ complaint });
});

/** Private evidence download — storage paths are never returned in JSON. */
adminComplaintsRouter.get("/complaints/:id/evidence/:evidenceId/file", async (req, res) => {
  const evidence = await prisma.complaintEvidence.findFirst({
    where: {
      id: String(req.params.evidenceId),
      complaintId: String(req.params.id),
    },
    select: {
      id: true,
      storagePath: true,
      originalName: true,
      mimeType: true,
      complaintId: true,
    },
  });
  if (!evidence) throw notFound("Evidence file not found.");

  await logPrivateFileAccess({
    actorId: req.user!.id,
    action: "admin.complaint.evidence_access",
    entityType: "complaint_evidence",
    entityId: evidence.id,
    reason: `complaint ${evidence.complaintId}`,
  });

  const filePath = privateFilePath(evidence.storagePath);
  if (!existsSync(filePath)) throw notFound("That file is no longer available.");
  applyPrivateFileHeaders(res, {
    contentType: evidence.mimeType || "application/octet-stream",
    filename: evidence.originalName,
    disposition: "inline",
  });
  res.sendFile(filePath);
});

adminComplaintsRouter.patch("/complaints/:id", async (req, res) => {
  const body = patchSchema.parse(req.body ?? {});
  const existing = await prisma.complaint.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      status: true,
      acknowledgedAt: true,
      memberResponseDueAt: true,
      decisionDueAt: true,
    },
  });
  if (!existing) throw notFound("Complaint not found.");

  if (body.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: body.assigneeId },
      select: { id: true, role: true },
    });
    if (!assignee || assignee.role !== "ADMIN") {
      throw conflict("Assignee must be an admin user.", { fields: { assigneeId: "must be an admin" } });
    }
  }

  const now = new Date();
  const nextStatus = body.status ?? existing.status;
  const stampAck = nextStatus === "under_review" && !existing.acknowledgedAt;

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: existing.id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.assigneeId !== undefined ? { reviewerId: body.assigneeId } : {}),
        ...(stampAck
          ? {
              acknowledgedAt: now,
              memberResponseDueAt: existing.memberResponseDueAt ?? addBusinessDays(now, 5),
              decisionDueAt: existing.decisionDueAt ?? addBusinessDays(now, 30),
            }
          : {}),
      },
    });

    if (body.internalNote) {
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "complaint.internal_note",
          entityType: "complaint",
          entityId: existing.id,
          reason: body.internalNote,
        },
      });
    }

    if (body.status && body.status !== existing.status) {
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "complaint.status_change",
          entityType: "complaint",
          entityId: existing.id,
          reason: `Status ${existing.status} → ${body.status}`,
        },
      });
    }
  });

  res.json({ complaint: await getComplaintDetail(existing.id) });
});

adminComplaintsRouter.post("/complaints/:id/decision", async (req, res) => {
  const body = decisionSchema.parse(req.body ?? {});
  const existing = await prisma.complaint.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      isDraft: true,
      outcome: true,
      contactEmail: true,
      memberProfileId: true,
      member: {
        select: {
          id: true,
          memberStatus: true,
          user: { select: { email: true } },
        },
      },
    },
  });
  if (!existing) throw notFound("Complaint not found.");
  if (existing.isDraft) throw conflict("Cannot decide a draft complaint.");
  if (existing.status === "decided" && existing.outcome) {
    throw conflict("A decision has already been recorded for this complaint.");
  }
  if (existing.status === "under_appeal") {
    throw conflict("This complaint is under appeal. Use the appeal-decision endpoint.");
  }

  const now = new Date();
  const appealDeadline = addBusinessDays(now, 10);

  const memberUpdate = await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: existing.id },
      data: {
        status: "decided",
        outcome: body.outcome,
        reasons: body.reasons,
        conflictDeclared: true,
        decidedAt: now,
        appealDeadline,
        reviewerId: req.user!.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "complaint.decision",
        entityType: "complaint",
        entityId: existing.id,
        reason: body.reasons,
        conflictDeclared: true,
      },
    });

    if (!(body.outcome === "suspension" || body.outcome === "revocation") || !existing.memberProfileId || !existing.member) {
      return null;
    }

    const toStatus = body.outcome === "suspension" ? ("suspended" as const) : ("revoked" as const);
    const member = await tx.memberProfile.update({
      where: { id: existing.memberProfileId },
      data: { memberStatus: toStatus },
      select: { id: true, memberStatus: true, validUntil: true },
    });

    await tx.statusHistory.create({
      data: {
        memberProfileId: existing.memberProfileId,
        fromStatus: existing.member.memberStatus,
        toStatus,
        reason: body.reasons,
        actorId: req.user!.id,
        conflictDeclared: true,
      },
    });

    if (toStatus === "revoked") {
      const latestCert = await tx.certificate.findFirst({
        where: { memberProfileId: existing.memberProfileId, status: "active" },
        orderBy: { issuedAt: "desc" },
        select: { id: true },
      });
      if (latestCert) {
        await tx.certificate.update({ where: { id: latestCert.id }, data: { status: "revoked" } });
      }
    }

    return member;
  });

  await notifyComplaintDecision({
    complainantEmail: existing.contactEmail,
    memberEmail: existing.member?.user.email ?? null,
    referenceNumber: existing.referenceNumber,
    outcome: body.outcome,
    reasons: body.reasons,
    appealDeadline,
    complaintId: existing.id,
  });
  if (memberUpdate?.memberStatus === "suspended" || memberUpdate?.memberStatus === "revoked") {
    const memberEmail = existing.member?.user.email;
    if (memberEmail) {
      await notifyMemberStatusChange({
        to: memberEmail,
        status: memberUpdate.memberStatus,
        reason: body.reasons,
        memberProfileId: existing.memberProfileId!,
      });
    }
  }

  res.json({
    complaint: await getComplaintDetail(existing.id),
    member: memberUpdate,
  });
});

adminComplaintsRouter.post("/complaints/:id/appeal-decision", async (req, res) => {
  const body = appealDecisionSchema.parse(req.body ?? {});
  const existing = await prisma.complaint.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      referenceNumber: true,
      contactEmail: true,
      status: true,
      reviewerId: true,
      member: { select: { user: { select: { email: true } } } },
      appeals: {
        where: { decidedAt: null },
        orderBy: { lodgedAt: "desc" },
        take: 1,
        select: { id: true, reviewerId: true },
      },
    },
  });
  if (!existing) throw notFound("Complaint not found.");
  if (existing.status !== "under_appeal") {
    throw conflict("This complaint is not under appeal.");
  }

  const openAppeal = existing.appeals[0];
  if (!openAppeal) throw conflict("There is no open appeal to decide.");

  // Appeal must be heard by a different person than the original decision-maker.
  if (existing.reviewerId && existing.reviewerId === req.user!.id) {
    throw forbidden("A different reviewer must decide the appeal.");
  }

  const now = new Date();
  const appeal = await prisma.$transaction(async (tx) => {
    const decided = await tx.complaintAppeal.update({
      where: { id: openAppeal.id },
      data: {
        decidedAt: now,
        decision: body.decision,
        reasons: body.reasons,
        conflictDeclared: true,
        reviewerId: req.user!.id,
      },
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
    });

    await tx.complaint.update({
      where: { id: existing.id },
      data: { status: "decided" },
    });

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "complaint.appeal_decision",
        entityType: "complaint_appeal",
        entityId: decided.id,
        reason: body.reasons,
        conflictDeclared: true,
      },
    });

    return decided;
  });

  await notifyComplaintAppealDecision({
    complainantEmail: existing.contactEmail,
    memberEmail: existing.member?.user.email ?? null,
    referenceNumber: existing.referenceNumber,
    decision: body.decision,
    reasons: body.reasons,
    complaintId: existing.id,
  });

  res.json({
    appeal,
    complaint: await getComplaintDetail(existing.id),
  });
});
