import { Router } from "express";
import { z } from "zod";
import {
  getMemberDetail,
  listAuditLog,
  listMemberHistory,
  listMembers,
} from "../lib/adminMemberQueries.js";
import { liveCertificateStatus } from "../lib/certificates.js";
import { conflict, notFound } from "../lib/http.js";
import { notifyMemberStatusChange } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Admin member directory, status changes, history, and audit log.
 * Extends /api/admin without duplicating applications review.
 */
export const adminMembersRouter = Router();
adminMembersRouter.use(requireRole("ADMIN"));

const memberListSchema = z.object({
  status: z.enum(["active", "suspended", "expired", "revoked", "resigned"]).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const auditListSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const statusSchema = z.object({
  status: z.enum(["active", "suspended", "expired", "revoked", "resigned"]),
  reason: z.string().trim().min(10, "must be at least 10 characters"),
  conflictDeclared: z.literal(true, { error: "conflict declaration is required" }),
});

adminMembersRouter.get("/members", async (req, res) => {
  const query = memberListSchema.parse(req.query);
  res.json(await listMembers(query));
});

adminMembersRouter.get("/members/:id", async (req, res) => {
  const member = await getMemberDetail(String(req.params.id));
  if (!member) throw notFound("Member not found.");
  res.json({ member });
});

adminMembersRouter.get("/members/:id/history", async (req, res) => {
  const history = await listMemberHistory(String(req.params.id));
  if (!history) throw notFound("Member not found.");
  res.json({ history });
});

adminMembersRouter.post("/members/:id/status", async (req, res) => {
  const body = statusSchema.parse(req.body ?? {});
  const profile = await prisma.memberProfile.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      memberStatus: true,
      firstName: true,
      lastName: true,
      tradingName: true,
      scope: true,
      validFrom: true,
      validUntil: true,
      user: { select: { id: true, email: true } },
      certificates: {
        orderBy: { issuedAt: "desc" },
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
    },
  });
  if (!profile) throw notFound("Member not found.");
  if (profile.memberStatus === body.status) {
    throw conflict(`Member status is already ${body.status}.`);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.memberProfile.update({
      where: { id: profile.id },
      data: { memberStatus: body.status },
      select: {
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
      },
    });

    // Keep stored certificate status in step with membership for revoked/resigned/expired.
    if (profile.certificates[0] && (body.status === "revoked" || body.status === "resigned" || body.status === "expired")) {
      await tx.certificate.update({
        where: { id: profile.certificates[0].id },
        data: { status: body.status },
      });
    }

    const historyEntry = await tx.statusHistory.create({
      data: {
        memberProfileId: profile.id,
        fromStatus: profile.memberStatus,
        toStatus: body.status,
        reason: body.reason,
        actorId: req.user!.id,
        conflictDeclared: true,
      },
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

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "member.status_change",
        entityType: "member_profile",
        entityId: profile.id,
        reason: body.reason,
        conflictDeclared: true,
      },
    });

    return { updated, historyEntry };
  });

  const certificate = profile.certificates[0]
    ? {
        ...profile.certificates[0],
        status:
          body.status === "revoked" || body.status === "resigned" || body.status === "expired"
            ? body.status
            : profile.certificates[0].status,
      }
    : null;

  await notifyMemberStatusChange({
    to: profile.user.email,
    status: body.status,
    reason: body.reason,
    memberProfileId: profile.id,
  });

  res.json({
    member: {
      id: result.updated.id,
      userId: profile.user.id,
      email: profile.user.email,
      firstName: result.updated.firstName,
      lastName: result.updated.lastName,
      phone: result.updated.phone,
      tradingName: result.updated.tradingName,
      scope: result.updated.scope,
      memberStatus: result.updated.memberStatus,
      validFrom: result.updated.validFrom,
      validUntil: result.updated.validUntil,
      createdAt: result.updated.createdAt,
      updatedAt: result.updated.updatedAt,
      certificate: certificate
        ? {
            id: certificate.id,
            number: certificate.number,
            issuedAt: certificate.issuedAt,
            validFrom: certificate.validFrom,
            validUntil: certificate.validUntil,
            scope: certificate.scope,
            qrTargetUrl: certificate.qrTargetUrl,
            status: liveCertificateStatus(result.updated, certificate, now),
            storedStatus: certificate.status,
            hasPdf: Boolean(certificate.pdfPath),
          }
        : null,
    },
    historyEntry: {
      id: result.historyEntry.id,
      from: result.historyEntry.fromStatus,
      to: result.historyEntry.toStatus,
      reason: result.historyEntry.reason,
      conflictDeclared: result.historyEntry.conflictDeclared,
      at: result.historyEntry.createdAt,
      actor: result.historyEntry.actor,
    },
  });
});

adminMembersRouter.get("/audit", async (req, res) => {
  const query = auditListSchema.parse(req.query);
  res.json(await listAuditLog(query));
});
