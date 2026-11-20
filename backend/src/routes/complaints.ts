import { Router } from "express";
import { z } from "zod";
import {
  findMemberForComplaint,
  isComplaintComplete,
  nextComplaintReferenceNumber,
  serializePublicComplaint,
} from "../lib/complaints.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { authLimiter } from "../lib/rateLimit.js";
import { assertFileSignature, complaintUpload, removePrivateFile } from "../lib/uploads.js";

/**
 * Public complaint intake, status by reference, and appeal lodging.
 * Evidence stays private; public GET never returns file paths.
 */
export const complaintsRouter = Router();

const optionalText = (max: number) =>
  z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      return value.trim();
    })
    .pipe(z.union([z.string().max(max), z.null()]).optional());

const createSchema = z.object({
  type: z.enum(["misconduct", "impersonation", "badge_misuse"]).optional(),
  description: optionalText(5000),
  contactName: optionalText(150),
  contactEmail: z
    .union([z.string(), z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      return value.trim().toLowerCase();
    })
    .pipe(z.union([z.string().email("must be a valid email address"), z.null()]).optional()),
  contactPhone: optionalText(30),
  memberProfileId: optionalText(64),
  certificateNumber: optionalText(32),
  /** Name or social handle when the subject is not on the register (impersonation / badge_misuse). */
  subjectLabel: optionalText(200),
  consent: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
  draft: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === true || value === "true" || value === "1";
    }),
});

function boolConsent(value: boolean | undefined) {
  return value === true;
}

complaintsRouter.post("/", authLimiter, (req, res, next) => {
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.includes("multipart/form-data")) {
    return complaintUpload.array("evidence", 5)(req, res, next);
  }
  return next();
}, async (req, res) => {
  const body = createSchema.parse(req.body ?? {});
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  try {
    for (const file of files) {
      // Multer may decode filenames as latin1
      file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      await assertFileSignature(file);
    }

    const member = await findMemberForComplaint({
      memberProfileId: body.memberProfileId,
      certificateNumber: body.certificateNumber,
    });
    if ((body.memberProfileId || body.certificateNumber) && !member) {
      throw badRequest("We could not find that member.", {
        fields: { member: "not found" },
      });
    }

    if (body.type === "misconduct" && body.subjectLabel && !member) {
      throw badRequest("Misconduct reports must name a registered member.", {
        fields: { member: "is required", subjectLabel: "not used for misconduct" },
      });
    }

    const subjectLabel = body.subjectLabel?.trim() || null;
    const consentAt = boolConsent(body.consent) ? new Date() : null;
    const wantDraft = body.draft === true;
    const complete = isComplaintComplete({
      type: body.type,
      description: body.description,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      consentAt,
      memberProfileId: member?.id ?? null,
      subjectLabel,
    });

    if (!wantDraft && !complete) {
      const needsFreeText = body.type === "impersonation" || body.type === "badge_misuse";
      throw badRequest(
        needsFreeText
          ? "A complete report needs type, description, contact name and email, privacy consent, and either a member lookup or a name/social handle."
          : "A complete report needs type, description, contact name and email, privacy consent, and a member lookup.",
        {
          fields: {
            type: body.type ? "ok" : "is required",
            description: body.description ? "ok" : "is required",
            contactName: body.contactName ? "ok" : "is required",
            contactEmail: body.contactEmail ? "ok" : "is required",
            consent: consentAt ? "ok" : "is required",
            member: member ? "ok" : needsFreeText ? "optional when subjectLabel is set" : "is required",
            subjectLabel: subjectLabel ? "ok" : needsFreeText ? "required when no member is selected" : "ok",
          },
        },
      );
    }

    if (!body.type) {
      throw badRequest("Choose a complaint type.", { fields: { type: "is required" } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const referenceNumber = complete && !wantDraft ? await nextComplaintReferenceNumber(tx) : null;
      const complaint = await tx.complaint.create({
        data: {
          type: body.type!,
          description: body.description ?? null,
          contactName: body.contactName ?? null,
          contactEmail: body.contactEmail ?? null,
          contactPhone: body.contactPhone ?? null,
          consentAt,
          memberProfileId: member?.id ?? null,
          subjectLabel,
          isDraft: !complete || wantDraft === true,
          status: "received",
          referenceNumber,
        },
        select: {
          id: true,
          referenceNumber: true,
          type: true,
          status: true,
          description: true,
          subjectLabel: true,
          isDraft: true,
          acknowledgedAt: true,
          memberResponseDueAt: true,
          decisionDueAt: true,
          decidedAt: true,
          appealDeadline: true,
          outcome: true,
          createdAt: true,
          updatedAt: true,
          member: { select: { firstName: true, lastName: true, tradingName: true } },
          _count: { select: { evidence: true, responses: true } },
          appeals: { select: { id: true, lodgedAt: true, decidedAt: true, decision: true } },
        },
      });

      for (const file of files) {
        await tx.complaintEvidence.create({
          data: {
            complaintId: complaint.id,
            storagePath: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
      }

      if (files.length) {
        const recounted = await tx.complaint.findUnique({
          where: { id: complaint.id },
          select: { _count: { select: { evidence: true, responses: true } } },
        });
        return { ...complaint, _count: recounted?._count ?? complaint._count };
      }
      return complaint;
    });

    res.status(201).json({
      complaint: serializePublicComplaint(result),
      referenceNumber: result.referenceNumber,
    });
  } catch (error) {
    for (const file of files) {
      await removePrivateFile(file.filename).catch(() => {});
    }
    throw error;
  }
});

complaintsRouter.get("/:reference", async (req, res) => {
  const raw = String(req.params.reference ?? "").trim();
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

  const complaint = await prisma.complaint.findFirst({
    where: raw.toUpperCase().startsWith("PSSA-C-")
      ? { referenceNumber: raw.toUpperCase() }
      : { OR: [{ id: raw }, { referenceNumber: raw.toUpperCase() }] },
    select: {
      id: true,
      referenceNumber: true,
      type: true,
      status: true,
      description: true,
      subjectLabel: true,
      isDraft: true,
      contactEmail: true,
      memberProfileId: true,
      acknowledgedAt: true,
      memberResponseDueAt: true,
      decisionDueAt: true,
      decidedAt: true,
      appealDeadline: true,
      outcome: true,
      createdAt: true,
      updatedAt: true,
      member: { select: { firstName: true, lastName: true, tradingName: true, userId: true } },
      _count: { select: { evidence: true, responses: true } },
      appeals: {
        orderBy: { lodgedAt: "desc" },
        select: { id: true, lodgedAt: true, decidedAt: true, decision: true },
      },
    },
  });
  if (!complaint || complaint.isDraft) throw notFound("Complaint not found.");

  const isAdmin = req.user?.role === "ADMIN";
  const isNamedMember = Boolean(req.user && complaint.member?.userId === req.user.id);
  const emailMatches = Boolean(email && complaint.contactEmail && email === complaint.contactEmail.toLowerCase());

  if (!isAdmin && !isNamedMember && !emailMatches) {
    throw forbidden("Provide the contact email used on the report to view this complaint.");
  }

  const { contactEmail: _email, member, ...rest } = complaint;
  res.json({
    complaint: serializePublicComplaint({
      ...rest,
      member: member ? { firstName: member.firstName, lastName: member.lastName, tradingName: member.tradingName } : null,
    }),
  });
});

const appealSchema = z.object({
  reason: z.string().trim().min(10, "must be at least 10 characters").max(5000),
  email: z.string().trim().email("must be a valid email address").optional(),
});

complaintsRouter.post("/:id/appeal", authLimiter, async (req, res) => {
  const body = appealSchema.parse(req.body ?? {});
  const raw = String(req.params.id ?? "").trim();

  const complaint = await prisma.complaint.findFirst({
    where: raw.toUpperCase().startsWith("PSSA-C-")
      ? { referenceNumber: raw.toUpperCase() }
      : { OR: [{ id: raw }, { referenceNumber: raw.toUpperCase() }] },
    select: {
      id: true,
      status: true,
      isDraft: true,
      appealDeadline: true,
      contactEmail: true,
      memberProfileId: true,
      member: { select: { userId: true } },
      appeals: { where: { decidedAt: null }, select: { id: true }, take: 1 },
    },
  });
  if (!complaint || complaint.isDraft) throw notFound("Complaint not found.");
  if (complaint.status !== "decided") {
    throw conflict("An appeal can only be lodged after a decision has been recorded.");
  }
  if (!complaint.appealDeadline || new Date() > complaint.appealDeadline) {
    throw conflict("The appeal deadline has passed.");
  }
  if (complaint.appeals.length) throw conflict("An appeal has already been lodged for this complaint.");

  const isNamedMember = Boolean(req.user && complaint.member?.userId === req.user.id);
  const email = body.email?.toLowerCase() ?? (typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "");
  const emailMatches = Boolean(email && complaint.contactEmail && email === complaint.contactEmail.toLowerCase());
  if (!isNamedMember && !emailMatches && req.user?.role !== "ADMIN") {
    throw forbidden("Only the complainant (with matching email) or the named member may lodge an appeal.");
  }

  const appeal = await prisma.$transaction(async (tx) => {
    const created = await tx.complaintAppeal.create({
      data: { complaintId: complaint.id, reason: body.reason },
      select: { id: true, reason: true, lodgedAt: true, decidedAt: true, decision: true },
    });
    await tx.complaint.update({
      where: { id: complaint.id },
      data: { status: "under_appeal" },
    });
    return created;
  });

  res.status(201).json({ appeal });
});
