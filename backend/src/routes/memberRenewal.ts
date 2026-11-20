import { Router } from "express";
import { z } from "zod";
import { conflict, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  canStartRenewal,
  findOpenRenewal,
  getMemberRenewalStatus,
  serializeRenewal,
  startRenewal,
} from "../lib/renewals.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Member renewal window, start, and annual declaration on KG’s Renewal model.
 */
export const memberRenewalRouter = Router();
memberRenewalRouter.use(requireRole("MEMBER"));

async function loadRenewalMember(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberProfile: {
        select: {
          id: true,
          memberStatus: true,
          validUntil: true,
        },
      },
    },
  });
  if (!user?.memberProfile) throw notFound("Member profile not found.");
  return user;
}

memberRenewalRouter.get("/renewal", async (req, res) => {
  const user = await loadRenewalMember(req.user!.id);
  const profile = user.memberProfile!;
  res.json(
    await getMemberRenewalStatus({
      memberProfileId: profile.id,
      userId: user.id,
      memberStatus: profile.memberStatus,
      validUntil: profile.validUntil,
    }),
  );
});

const startSchema = z
  .object({
    confirm: z.boolean().optional(),
  })
  .optional();

memberRenewalRouter.post("/renewal/start", async (req, res) => {
  startSchema.parse(req.body ?? {});
  const user = await loadRenewalMember(req.user!.id);
  const profile = user.memberProfile!;

  const eligibility = canStartRenewal({
    memberStatus: profile.memberStatus,
    validUntil: profile.validUntil,
  });
  if (!eligibility.ok) throw conflict(eligibility.reason);

  const renewal = await startRenewal(profile.id, eligibility.windowOpensAt);
  res.status(201).json({ renewal });
});

const declarationSchema = z.object({
  accepted: z.literal(true, { error: "must accept the annual declaration" }),
  version: z.string().trim().min(1, "is required").max(50),
  statements: z.string().trim().max(5000).optional(),
});

memberRenewalRouter.post("/renewal/declaration", async (req, res) => {
  const body = declarationSchema.parse(req.body ?? {});
  const user = await loadRenewalMember(req.user!.id);
  const profile = user.memberProfile!;

  const open = await findOpenRenewal(profile.id);
  if (!open) throw conflict("Start a renewal before submitting the declaration.");
  if (open.status !== "draft" && open.status !== "needs_info") {
    throw conflict("The annual declaration can only be updated while the renewal is a draft or needs information.");
  }

  const now = new Date();
  const renewal = await prisma.renewal.update({
    where: { id: open.id },
    data: {
      declarationAcceptedAt: now,
      declarationVersion: body.version,
      declarationStatements: body.statements ?? null,
      status: "submitted",
      submittedAt: now,
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

  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: "renewal.declaration",
      entityType: "renewal",
      entityId: renewal.id,
      reason: `Annual declaration ${body.version} accepted`,
    },
  });

  res.json({ renewal: serializeRenewal(renewal) });
});
