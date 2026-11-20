import { Router } from "express";
import { z } from "zod";
import { ensureCertificatePdf } from "../lib/certificatePdf.js";
import { issueCertificateOnActivation, liveCertificateStatus, serializeCertificate } from "../lib/certificates.js";
import { conflict, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  buildRenewalChecklist,
  findRenewalById,
  nextValidUntil,
  serializeRenewal,
} from "../lib/renewals.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Admin renewal decisions on KG’s Renewal model.
 * Approval extends validity; it never lifts a suspension or activates from a fee alone.
 */
export const adminRenewalsRouter = Router();
adminRenewalsRouter.use(requireRole("ADMIN"));

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_info"]),
  reason: z.string().trim().min(10, "must be at least 10 characters"),
  conflictDeclared: z.literal(true, { error: "conflict declaration is required" }),
});

adminRenewalsRouter.post("/renewals/:id/decision", async (req, res) => {
  const body = decisionSchema.parse(req.body ?? {});
  const renewal = await findRenewalById(String(req.params.id));
  if (!renewal) throw notFound("Renewal not found.");

  if (renewal.status === "approved" || renewal.status === "rejected") {
    throw conflict("A final decision has already been recorded for this renewal.");
  }
  if (body.decision === "approved" && renewal.status !== "submitted" && renewal.status !== "needs_info") {
    throw conflict("Only a submitted renewal can be approved.");
  }

  const member = renewal.member;
  if (body.decision === "approved") {
    if (member.memberStatus === "suspended") {
      throw conflict("Approval cannot lift a suspension. Restore membership status first, then renew.");
    }
    if (member.memberStatus === "revoked" || member.memberStatus === "resigned") {
      throw conflict("Revoked or resigned members cannot be renewed.");
    }
    if (!renewal.declarationAcceptedAt || !renewal.declarationVersion) {
      throw conflict("Cannot approve without an accepted annual declaration.");
    }

    const checklist = await buildRenewalChecklist({
      memberProfileId: member.id,
      userId: member.userId,
      renewal,
    });
    const incomplete = checklist.filter((item) => !item.complete);
    if (incomplete.length) {
      throw conflict("Cannot approve until the renewal checklist is complete.", {
        fields: { checklist: incomplete.map((item) => item.key).join(",") },
        checklist,
      });
    }
  }

  const now = new Date();
  const validUntil = body.decision === "approved" ? nextValidUntil(member.validUntil, now) : null;
  const validFrom = body.decision === "approved" ? (member.validFrom && member.validFrom.getTime() <= now.getTime() ? member.validFrom : now) : null;

  const result = await prisma.$transaction(async (tx) => {
    const updatedRenewal = await tx.renewal.update({
      where: { id: renewal.id },
      data: {
        status: body.decision,
        decisionReason: body.reason,
        conflictDeclared: true,
        reviewerId: req.user!.id,
        decidedAt: now,
      },
      select: {
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
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "renewal.decision",
        entityType: "renewal",
        entityId: renewal.id,
        reason: body.reason,
        conflictDeclared: true,
      },
    });

    let updatedMember = {
      id: member.id,
      email: member.user.email,
      firstName: member.firstName,
      lastName: member.lastName,
      tradingName: member.tradingName,
      scope: member.scope,
      memberStatus: member.memberStatus,
      validFrom: member.validFrom,
      validUntil: member.validUntil,
    };
    let certificate = member.certificates[0] ?? null;

    if (body.decision === "approved" && validUntil && validFrom) {
      const fromStatus = member.memberStatus;
      const nextStatus = "active" as const;
      const profile = await tx.memberProfile.update({
        where: { id: member.id },
        data: {
          memberStatus: nextStatus,
          validFrom,
          validUntil,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tradingName: true,
          scope: true,
          memberStatus: true,
          validFrom: true,
          validUntil: true,
        },
      });

      if (fromStatus !== nextStatus) {
        await tx.statusHistory.create({
          data: {
            memberProfileId: member.id,
            fromStatus,
            toStatus: nextStatus,
            reason: body.reason,
            actorId: req.user!.id,
            conflictDeclared: true,
          },
        });
      }

      certificate = await issueCertificateOnActivation(tx, {
        memberProfileId: member.id,
        scope: member.scope,
        validFrom,
        validUntil,
        issuedById: req.user!.id,
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "renewal.activated",
          entityType: "member_profile",
          entityId: member.id,
          reason: `Renewal approved; valid until ${validUntil.toISOString()}`,
          conflictDeclared: true,
        },
      });

      updatedMember = {
        id: profile.id,
        email: member.user.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        tradingName: profile.tradingName,
        scope: profile.scope,
        memberStatus: profile.memberStatus,
        validFrom: profile.validFrom,
        validUntil: profile.validUntil,
      };
    }

    return { renewal: updatedRenewal, member: updatedMember, certificate };
  });

  let certificateOut = null;
  if (result.certificate && body.decision === "approved") {
    const withPdf = await ensureCertificatePdf(result.certificate, {
      firstName: result.member.firstName,
      lastName: result.member.lastName,
      tradingName: result.member.tradingName,
      scope: result.member.scope,
    });
    certificateOut = serializeCertificate(
      withPdf,
      liveCertificateStatus(
        { memberStatus: result.member.memberStatus, validUntil: result.member.validUntil },
        withPdf,
        now,
      ),
    );
  }

  res.json({
    renewal: serializeRenewal(result.renewal),
    member: result.member,
    certificate: certificateOut,
  });
});
