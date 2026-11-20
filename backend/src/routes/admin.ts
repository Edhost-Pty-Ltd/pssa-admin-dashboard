import { Router } from "express";
import { existsSync } from "node:fs";
import { z } from "zod";
import { evaluateActivationGates } from "../lib/activationGates.js";
import { applicationSummary, listApplications } from "../lib/adminApplicationQueries.js";
import { ensureCertificatePdf } from "../lib/certificatePdf.js";
import { issueCertificateOnActivation, liveCertificateStatus, serializeCertificate } from "../lib/certificates.js";
import { attemptHistory, hasPassedEntranceExam, tutorialCompletion } from "../lib/examReviewQueries.js";
import { conflict, notFound } from "../lib/http.js";
import { applyPrivateFileHeaders, logPrivateFileAccess } from "../lib/privateFiles.js";
import { notifyApplicationDecision } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { privateFilePath } from "../lib/uploads.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Admin application review against the Phase 1 schema.
 * Approve records a decision; Active is only set when every activation gate passes.
 */
export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

const MEMBERSHIP_MONTHS = 12;

async function loadDecisionContext(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      number: true,
      status: true,
      userId: true,
      agreementAcceptedAt: true,
      agreementVersion: true,
      submittedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          memberProfile: {
            select: { id: true, memberStatus: true, scope: true, firstName: true, lastName: true, tradingName: true },
          },
          documents: { select: { type: true, status: true }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
}

const listSchema = z.object({
  status: z.enum(["draft", "submitted", "under_review", "needs_info", "approved", "rejected"]).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

adminRouter.get("/summary", async (_req, res) => {
  res.json(await applicationSummary());
});

adminRouter.get("/applications", async (req, res) => {
  const { status, q, page, pageSize } = listSchema.parse(req.query);
  res.json(await listApplications({ status, q, page, pageSize }));
});

adminRouter.get("/applications/:id", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      number: true,
      status: true,
      submittedAt: true,
      agreementAcceptedAt: true,
      agreementVersion: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          memberProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              tradingName: true,
              scope: true,
              physicalAddress: true,
              city: true,
              memberStatus: true,
              channels: true,
            },
          },
          documents: {
            select: {
              id: true,
              type: true,
              originalName: true,
              status: true,
              reviewerNote: true,
              reviewedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          decision: true,
          reason: true,
          conflictDeclared: true,
          createdAt: true,
          reviewer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!application) throw notFound("Application not found.");

  const channels = application.user.memberProfile
    ? await prisma.channel.findMany({
        where: { memberProfileId: application.user.memberProfile.id },
        select: { status: true },
      })
    : [];
  const examPassed = application.user.memberProfile
    ? await hasPassedEntranceExam(application.user.memberProfile.id)
    : false;
  const activation = evaluateActivationGates({
    application,
    profile: application.user.memberProfile,
    documents: application.user.documents,
    channels,
    examPassed,
    recordingApproval: false,
  });

  res.json({ application, activation });
});

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_info"]),
  reason: z.string().trim().min(10, "must be at least 10 characters"),
  conflictDeclared: z.literal(true, { error: "conflict declaration is required" }),
});

adminRouter.post("/applications/:id/decision", async (req, res) => {
  const body = decisionSchema.parse(req.body ?? {});
  const application = await loadDecisionContext(String(req.params.id));
  if (!application) throw notFound("Application not found.");
  if (application.status === "approved" || application.status === "rejected") {
    throw conflict("A final decision has already been recorded for this application.");
  }
  if (!application.user.memberProfile) throw conflict("This application has no member profile.");

  const channels = await prisma.channel.findMany({
    where: { memberProfileId: application.user.memberProfile.id },
    select: { status: true },
  });
  const examPassed = await hasPassedEntranceExam(application.user.memberProfile.id);

  const activation = evaluateActivationGates({
    application,
    profile: application.user.memberProfile,
    documents: application.user.documents,
    channels,
    examPassed,
    recordingApproval: body.decision === "approved",
  });

  if (body.decision === "approved" && !activation.canRecordApproval) {
    throw conflict("Cannot approve until verification documents are accepted and the membership agreement is on file.", {
      fields: { gates: activation.missing.filter((key) => key === "verification" || key === "agreement").join(",") || "incomplete" },
      activation,
    });
  }

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setMonth(validUntil.getMonth() + MEMBERSHIP_MONTHS);

  const result = await prisma.$transaction(async (tx) => {
    const next = await tx.application.update({
      where: { id: application.id },
      data: { status: body.decision },
      select: {
        id: true,
        number: true,
        status: true,
        submittedAt: true,
        agreementAcceptedAt: true,
        agreementVersion: true,
      },
    });

    await tx.adminReview.create({
      data: {
        applicationId: application.id,
        reviewerId: req.user!.id,
        decision: body.decision,
        reason: body.reason,
        conflictDeclared: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "application.decision",
        entityType: "application",
        entityId: application.id,
        reason: body.reason,
        conflictDeclared: true,
      },
    });

    let activated = false;
    let certificate = null as Awaited<ReturnType<typeof issueCertificateOnActivation>> | null;
    // Never set Active from approve alone — every gate must pass (exam included).
    if (body.decision === "approved" && activation.canActivate) {
      const profile = application.user.memberProfile!;
      const fromStatus = profile.memberStatus;
      await tx.memberProfile.update({
        where: { id: profile.id },
        data: {
          memberStatus: "active",
          validFrom: now,
          validUntil,
        },
      });
      await tx.statusHistory.create({
        data: {
          memberProfileId: profile.id,
          fromStatus,
          toStatus: "active",
          reason: body.reason,
          actorId: req.user!.id,
          conflictDeclared: true,
        },
      });
      certificate = await issueCertificateOnActivation(tx, {
        memberProfileId: profile.id,
        scope: profile.scope,
        validFrom: now,
        validUntil,
        issuedById: req.user!.id,
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "certificate.issued",
          entityType: "certificate",
          entityId: certificate.id,
          reason: `Issued ${certificate.number} on activation`,
          conflictDeclared: true,
        },
      });
      activated = true;
    } else if (body.decision === "approved") {
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "application.approval_without_activation",
          entityType: "application",
          entityId: application.id,
          reason: `Approved without Active. Missing gates: ${activation.missing.join(", ")}`,
          conflictDeclared: true,
        },
      });
    }

    return { application: next, activated, certificate };
  });

  let issuedCertificate = result.certificate;
  if (issuedCertificate && application.user.memberProfile) {
    issuedCertificate = await ensureCertificatePdf(issuedCertificate, {
      firstName: application.user.memberProfile.firstName ?? "",
      lastName: application.user.memberProfile.lastName ?? "",
      tradingName: application.user.memberProfile.tradingName ?? null,
      scope: application.user.memberProfile.scope,
    });
  }

  const certificateOut = issuedCertificate
    ? serializeCertificate(
        issuedCertificate,
        liveCertificateStatus(
          { memberStatus: "active", validUntil },
          issuedCertificate,
          now,
        ),
      )
    : null;

  const activationOut = {
    ...activation,
    activated: result.activated,
    certificate: certificateOut,
  };

  await notifyApplicationDecision({
    to: application.user.email,
    decision: body.decision,
    applicationNumber: result.application.number,
    activated: result.activated,
    reason: body.reason,
    applicationId: application.id,
  });

  res.json({ application: result.application, activation: activationOut, certificate: certificateOut });
});

const documentReviewSchema = z
  .object({
    reviewStatus: z.enum(["accepted", "needs_resubmission", "under_review"]),
    reviewerNote: z.string().trim().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.reviewStatus === "needs_resubmission" && (!body.reviewerNote || body.reviewerNote.length < 10)) {
      ctx.addIssue({ code: "custom", path: ["reviewerNote"], message: "must be at least 10 characters" });
    }
  });

adminRouter.patch("/documents/:id", async (req, res) => {
  const body = documentReviewSchema.parse(req.body ?? {});
  const existing = await prisma.document.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!existing) throw notFound("Document not found.");

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: {
      status: body.reviewStatus,
      reviewerNote: body.reviewerNote ?? null,
      reviewedAt: new Date(),
      reviewedById: req.user!.id,
    },
    select: {
      id: true,
      type: true,
      originalName: true,
      status: true,
      reviewerNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({ document });
});

adminRouter.get("/documents/:id/file", async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
  if (!document) throw notFound("Document not found.");
  await logPrivateFileAccess({
    actorId: req.user!.id,
    action: "admin.document.file_access",
    entityType: "document",
    entityId: document.id,
  });
  const filePath = privateFilePath(document.storagePath);
  if (!existsSync(filePath)) throw notFound("That file is no longer available.");
  const lower = document.originalName.toLowerCase();
  const contentType = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
        ? "image/jpeg"
        : lower.endsWith(".webp")
          ? "image/webp"
          : "application/octet-stream";
  applyPrivateFileHeaders(res, {
    contentType,
    filename: document.originalName,
    disposition: "inline",
  });
  res.sendFile(filePath);
});

adminRouter.get("/applications/:id/tutorial", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: String(req.params.id) },
    select: { user: { select: { memberProfile: { select: { id: true } } } } },
  });
  if (!application) throw notFound("Application not found.");
  if (!application.user.memberProfile) {
    res.json({ tutorial: null, reason: "This application has no member profile." });
    return;
  }
  const tutorial = await tutorialCompletion(application.user.memberProfile.id);
  res.json({ tutorial });
});

adminRouter.get("/applications/:id/exam", async (req, res) => {
  const application = await prisma.application.findUnique({
    where: { id: String(req.params.id) },
    select: { user: { select: { memberProfile: { select: { id: true } } } } },
  });
  if (!application) throw notFound("Application not found.");
  if (!application.user.memberProfile) {
    res.json({ exam: null, reason: "This application has no member profile." });
    return;
  }

  const memberProfileId = application.user.memberProfile.id;
  const [{ attempts, attemptCount }, passed] = await Promise.all([
    attemptHistory(memberProfileId, "entrance"),
    hasPassedEntranceExam(memberProfileId),
  ]);
  const latest = attempts[0] ?? null;
  const timeTakenSeconds =
    latest?.submittedAt && latest.startedAt
      ? Math.max(0, Math.round((latest.submittedAt.getTime() - latest.startedAt.getTime()) / 1000))
      : null;

  res.json({
    exam: {
      passed,
      attemptCount,
      latest: latest
        ? {
            id: latest.id,
            score: latest.score,
            percent: latest.percent,
            passed: latest.passed,
            criticalFailed: latest.criticalFailed,
            startedAt: latest.startedAt,
            submittedAt: latest.submittedAt,
            timeTakenSeconds,
          }
        : null,
      attempts,
    },
  });
});
