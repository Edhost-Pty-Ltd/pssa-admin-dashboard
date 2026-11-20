import { Router } from "express";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import type { DocumentType } from "@prisma/client";
import { z } from "zod";
import { certificatePdfDiskPath, ensureCertificatePdf } from "../lib/certificatePdf.js";
import {
  findCertificateForMember,
  liveCertificateStatus,
  serializeCertificate,
} from "../lib/certificates.js";
import { serializePublicComplaint } from "../lib/complaints.js";
import { hasPassedEntranceExam, tutorialCompletion } from "../lib/examReviewQueries.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { isValidIdentityNumber, maskIdNumber, nextApplicationNumber } from "../lib/members.js";
import { prisma } from "../lib/prisma.js";
import { applyPrivateFileHeaders, logPrivateFileAccess } from "../lib/privateFiles.js";
import { assertFileSignature, complaintUpload, documentUpload, privateFilePath, removePrivateFile } from "../lib/uploads.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Signed-in member profile, application tracker, documents and trading channels.
 * Private files stay on disk; the database stores the reference only.
 */
export const memberRouter = Router();
memberRouter.use(requireRole("MEMBER"));

const documentSelect = {
  id: true,
  type: true,
  originalName: true,
  status: true,
  reviewerNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const channelSelect = {
  id: true,
  kind: true,
  value: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const applicationSelect = {
  id: true,
  number: true,
  status: true,
  submittedAt: true,
  agreementAcceptedAt: true,
  agreementVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

const profileSelect = {
  id: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  memberProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      tradingName: true,
      scope: true,
      identityType: true,
      idNumber: true,
      physicalAddress: true,
      city: true,
      memberStatus: true,
      validFrom: true,
      validUntil: true,
      createdAt: true,
      updatedAt: true,
      channels: { select: channelSelect, orderBy: { createdAt: "asc" as const } },
    },
  },
  documents: { select: documentSelect, orderBy: { createdAt: "desc" as const } },
  applications: {
    select: applicationSelect,
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

type LoadedMember = NonNullable<Awaited<ReturnType<typeof loadMember>>>;

async function loadMember(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user?.memberProfile) throw notFound("Member profile not found.");
  return user;
}

function serializeProfile(user: LoadedMember) {
  const { applications: _apps, ...rest } = user;
  return {
    ...rest,
    memberProfile: {
      ...user.memberProfile!,
      idNumber: maskIdNumber(user.memberProfile!.idNumber),
    },
  };
}

type StepState = "complete" | "in_progress" | "action_needed" | "not_started" | "locked";

type ProgressStep = {
  key: "profile" | "documents" | "tutorials" | "assessment" | "review" | "certified";
  label: string;
  state: StepState;
  detail: string;
};

type ProgressAction = {
  step: "documents";
  title: string;
  detail: string;
  status: "needs_resubmission";
};

const EMPTY_APPLICATION = {
  id: null,
  number: null,
  status: "draft" as const,
  submittedAt: null,
  agreementAcceptedAt: null,
  agreementVersion: null,
};

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  id_document: "Identity document",
  proof_of_residence: "Proof of residence",
  bank_evidence: "Bank account evidence",
  business_registration: "Business registration",
  channel_evidence: "Channel evidence",
};

function serializeApplication(application: LoadedMember["applications"][number] | null) {
  if (!application) return EMPTY_APPLICATION;
  return {
    id: application.id,
    number: application.number,
    status: application.status,
    submittedAt: application.submittedAt,
    agreementAcceptedAt: application.agreementAcceptedAt,
    agreementVersion: application.agreementVersion,
  };
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function identityComplete(profile: LoadedMember["memberProfile"]) {
  if (!profile?.identityType || !hasText(profile.idNumber)) return false;
  return isValidIdentityNumber(profile.identityType, profile.idNumber!);
}

function profileComplete(profile: LoadedMember["memberProfile"]) {
  // tradingName is optional (mentor): members may trade under their own name.
  // Identity may be SA ID or passport (KG identityType).
  return Boolean(
    profile &&
      hasText(profile.firstName) &&
      hasText(profile.lastName) &&
      hasText(profile.phone) &&
      identityComplete(profile) &&
      hasText(profile.physicalAddress) &&
      hasText(profile.city) &&
      hasText(profile.scope),
  );
}

function profileStarted(profile: LoadedMember["memberProfile"]) {
  return Boolean(
    profile &&
      (hasText(profile.firstName) ||
        hasText(profile.lastName) ||
        hasText(profile.phone) ||
        Boolean(profile.identityType) ||
        hasText(profile.idNumber) ||
        hasText(profile.physicalAddress) ||
        hasText(profile.city) ||
        hasText(profile.tradingName) ||
        hasText(profile.scope)),
  );
}

function latestDocsByType(documents: LoadedMember["documents"]) {
  const latest = new Map<DocumentType, LoadedMember["documents"][number]>();
  for (const doc of documents) {
    if (!latest.has(doc.type)) latest.set(doc.type, doc);
  }
  return latest;
}

function documentsComplete(
  documents: LoadedMember["documents"],
  channels: NonNullable<LoadedMember["memberProfile"]>["channels"],
) {
  const latest = latestDocsByType(documents);
  const usable = (type: DocumentType) => {
    const doc = latest.get(type);
    return Boolean(doc && doc.status !== "needs_resubmission");
  };
  const hasId = usable("id_document");
  const hasAddressOrBiz = usable("proof_of_residence") || usable("business_registration");
  const hasBank = usable("bank_evidence");
  const hasChannel =
    channels.some((channel: { status: string }) => channel.status === "confirmed") || usable("channel_evidence");
  return hasId && hasAddressOrBiz && hasBank && hasChannel;
}

function documentActions(documents: LoadedMember["documents"]): ProgressAction[] {
  const latest = latestDocsByType(documents);
  const actions: ProgressAction[] = [];
  for (const doc of latest.values()) {
    if (doc.status !== "needs_resubmission") continue;
    actions.push({
      step: "documents",
      title: DOCUMENT_TITLES[doc.type],
      detail: doc.reviewerNote?.trim() || "Please replace this document.",
      status: "needs_resubmission",
    });
  }
  return actions;
}

async function buildProgress(user: LoadedMember) {
  const application = user.applications[0] ?? null;
  const profileDone = profileComplete(user.memberProfile);
  const docsDone = documentsComplete(user.documents, user.memberProfile!.channels);
  const actions = documentActions(user.documents);
  const agreementDone = Boolean(application?.agreementAcceptedAt && application.agreementVersion);
  const submitted = Boolean(application && application.status !== "draft");
  const needsInfo = application?.status === "needs_info";
  const certified = application?.status === "approved" || user.memberProfile!.memberStatus === "active";

  const memberId = user.memberProfile!.id;
  const tutorials = await tutorialCompletion(memberId);
  const tutorialsDone = tutorials.complete;
  const tutorialsTotal = tutorials.total;
  const tutorialsCompleted = tutorials.completedCount;
  const examDone = await hasPassedEntranceExam(memberId);

  const profileStep: ProgressStep = profileDone
    ? { key: "profile", label: "Profile", state: "complete", detail: "Complete" }
    : profileStarted(user.memberProfile)
      ? { key: "profile", label: "Profile", state: "in_progress", detail: "In progress" }
      : { key: "profile", label: "Profile", state: "not_started", detail: "Not started" };

  let documentsStep: ProgressStep;
  if (!profileDone) {
    documentsStep = { key: "documents", label: "Verification documents", state: "locked", detail: "Locked" };
  } else if (actions.length) {
    documentsStep = {
      key: "documents",
      label: "Verification documents",
      state: "action_needed",
      detail: `${actions.length} need${actions.length === 1 ? "s" : ""} resubmission`,
    };
  } else if (docsDone) {
    documentsStep = { key: "documents", label: "Verification documents", state: "complete", detail: "Complete" };
  } else if (user.documents.length || user.memberProfile!.channels.length) {
    documentsStep = { key: "documents", label: "Verification documents", state: "in_progress", detail: "In progress" };
  } else {
    documentsStep = { key: "documents", label: "Verification documents", state: "not_started", detail: "Not started" };
  }

  let tutorialsStep: ProgressStep;
  if (!profileDone) {
    tutorialsStep = { key: "tutorials", label: "Conduct tutorials", state: "locked", detail: "Locked" };
  } else if (tutorialsTotal === 0) {
    tutorialsStep = {
      key: "tutorials",
      label: "Conduct tutorials",
      state: "not_started",
      detail: "Waiting for official tutorials",
    };
  } else if (tutorialsDone) {
    tutorialsStep = {
      key: "tutorials",
      label: "Conduct tutorials",
      state: "complete",
      detail: `${tutorialsCompleted} of ${tutorialsTotal} complete`,
    };
  } else if (tutorialsCompleted > 0) {
    tutorialsStep = {
      key: "tutorials",
      label: "Conduct tutorials",
      state: "in_progress",
      detail: `${tutorialsCompleted} of ${tutorialsTotal} complete`,
    };
  } else {
    tutorialsStep = {
      key: "tutorials",
      label: "Conduct tutorials",
      state: "not_started",
      detail: `${tutorialsCompleted} of ${tutorialsTotal} complete`,
    };
  }

  let assessmentStep: ProgressStep;
  if (!tutorialsDone) {
    assessmentStep = { key: "assessment", label: "Entrance assessment", state: "locked", detail: "Locked" };
  } else if (examDone) {
    assessmentStep = { key: "assessment", label: "Entrance assessment", state: "complete", detail: "Complete" };
  } else {
    assessmentStep = { key: "assessment", label: "Entrance assessment", state: "not_started", detail: "Not started" };
  }

  let reviewStep: ProgressStep;
  if (certified || application?.status === "approved") {
    reviewStep = { key: "review", label: "Review", state: "complete", detail: "Complete" };
  } else if (needsInfo) {
    reviewStep = { key: "review", label: "Review", state: "action_needed", detail: "Action needed" };
  } else if (submitted) {
    reviewStep = { key: "review", label: "Review", state: "in_progress", detail: "Under review" };
  } else if (profileDone && docsDone && agreementDone) {
    reviewStep = { key: "review", label: "Review", state: "not_started", detail: "Ready to submit" };
  } else {
    reviewStep = { key: "review", label: "Review", state: "locked", detail: "Locked" };
  }

  const certifiedStep: ProgressStep = certified
    ? { key: "certified", label: "Certified", state: "complete", detail: "Certified" }
    : { key: "certified", label: "Certified", state: "locked", detail: "Locked" };

  const steps = [profileStep, documentsStep, tutorialsStep, assessmentStep, reviewStep, certifiedStep];
  const percent = Math.round((steps.filter((step) => step.state === "complete").length / steps.length) * 100);
  const canSubmit =
    profileDone &&
    docsDone &&
    agreementDone &&
    (!application || application.status === "draft" || application.status === "needs_info");

  return { percent, steps, actions, canSubmit };
}

async function getOrCreateDraftApplication(userId: string) {
  const existing = await prisma.application.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: applicationSelect,
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const number = await nextApplicationNumber(tx);
    return tx.application.create({
      data: { userId, number, status: "draft" },
      select: applicationSelect,
    });
  });
}

const text = (max: number) => z.string().trim().min(1, "is required").max(max, `must be at most ${max} characters`);

const phoneSchema = z
  .string()
  .trim()
  .max(30, "must be at most 30 characters")
  .refine((value) => /^\+?[\d\s()-]+$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15, "must be a valid phone number");

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const nullableText = (max: number) => z.union([z.null(), z.literal("").transform(() => null), text(max)]);
const nullableUrl = z.union([
  z.null(),
  z.literal("").transform(() => null),
  z.string().trim().refine(isHttpUrl, "must be a valid URL"),
]);

/** Omitted fields stay as they are. Null or "" clears optional profile/channel fields. */
const updateSchema = z
  .object({
    firstName: text(100).optional(),
    lastName: text(100).optional(),
    phone: z.union([z.null(), z.literal("").transform(() => null), phoneSchema]).optional(),
    tradingName: nullableText(150).optional(),
    scope: nullableText(150).optional(),
    identityType: z.enum(["sa_id", "passport"], { error: 'must be "sa_id" or "passport"' }).optional(),
    idNumber: z
      .string()
      .transform((value) => value.replace(/\s/g, "").toUpperCase())
      .optional(),
    physicalAddress: nullableText(300).optional(),
    city: nullableText(100).optional(),
    facebookUrl: nullableUrl.optional(),
    instagramUrl: nullableUrl.optional(),
    tiktokUrl: nullableUrl.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: "Provide at least one field to update." });

memberRouter.get("/profile", async (req, res) => {
  res.json({ profile: serializeProfile(await loadMember(req.user!.id)) });
});

memberRouter.patch("/profile", async (req, res) => {
  const body = updateSchema.parse(req.body ?? {});
  const current = await loadMember(req.user!.id);
  const memberId = current.memberProfile!.id;
  const nextIdentityType = body.identityType ?? current.memberProfile!.identityType ?? null;
  const nextIdNumber = body.idNumber !== undefined ? body.idNumber : current.memberProfile!.idNumber;

  if (body.identityType !== undefined || body.idNumber !== undefined) {
    if (!nextIdentityType) {
      throw badRequest("Choose an identity type (sa_id or passport).", { fields: { identityType: "is required" } });
    }
    if (nextIdNumber && !isValidIdentityNumber(nextIdentityType, nextIdNumber)) {
      throw badRequest(
        nextIdentityType === "sa_id"
          ? "must be a valid 13-digit South African ID number"
          : "must be a valid passport number (6–12 letters or digits)",
        { fields: { idNumber: nextIdentityType === "sa_id" ? "must be a valid SA ID number" : "must be a valid passport number" } },
      );
    }
  }

  if (body.idNumber && body.idNumber !== current.memberProfile!.idNumber) {
    const taken = await prisma.memberProfile.findUnique({ where: { idNumber: body.idNumber }, select: { id: true } });
    if (taken) {
      throw conflict("A member with this identity number is already registered.", { fields: { idNumber: "is already registered" } });
    }
  }

  const userFields = {
    ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
    ...(body.phone !== undefined && body.phone !== current.memberProfile!.phone ? { phoneVerifiedAt: null } : {}),
  };
  const memberFields = {
    ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
    ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.tradingName !== undefined ? { tradingName: body.tradingName } : {}),
    ...(body.scope !== undefined ? { scope: body.scope } : {}),
    ...(body.identityType !== undefined ? { identityType: body.identityType } : {}),
    ...(body.idNumber !== undefined ? { idNumber: body.idNumber } : {}),
    ...(body.physicalAddress !== undefined ? { physicalAddress: body.physicalAddress } : {}),
    ...(body.city !== undefined ? { city: body.city } : {}),
  };

  const channelUpdates: Array<[string, string | null]> = [];
  if (body.facebookUrl !== undefined) channelUpdates.push(["facebook", body.facebookUrl]);
  if (body.instagramUrl !== undefined) channelUpdates.push(["instagram", body.instagramUrl]);
  if (body.tiktokUrl !== undefined) channelUpdates.push(["tiktok", body.tiktokUrl]);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userFields).length) await tx.user.update({ where: { id: current.id }, data: userFields });
    if (Object.keys(memberFields).length) await tx.memberProfile.update({ where: { id: memberId }, data: memberFields });

    for (const [kind, value] of channelUpdates) {
      const existing = await tx.channel.findFirst({ where: { memberProfileId: memberId, kind }, select: { id: true } });
      if (value === null) {
        if (existing) await tx.channel.delete({ where: { id: existing.id } });
      } else if (existing) {
        await tx.channel.update({ where: { id: existing.id }, data: { value, status: "code_sent" } });
      } else {
        await tx.channel.create({ data: { memberProfileId: memberId, kind, value, status: "code_sent" } });
      }
    }
  });

  res.json({ profile: serializeProfile(await loadMember(current.id)) });
});

memberRouter.get("/certificate", async (req, res) => {
  const member = await loadMember(req.user!.id);
  const certificate = await findCertificateForMember(member.memberProfile!.id);
  if (!certificate) {
    res.json({ certificate: null, reason: "No certificate has been issued yet." });
    return;
  }
  res.json({
    certificate: serializeCertificate(
      certificate,
      liveCertificateStatus(member.memberProfile!, certificate),
    ),
  });
});

memberRouter.get("/certificate/pdf", async (req, res) => {
  const member = await loadMember(req.user!.id);
  const profile = member.memberProfile!;
  let certificate = await findCertificateForMember(profile.id);
  if (!certificate) throw notFound("No certificate has been issued yet.");

  certificate = await ensureCertificatePdf(certificate, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    tradingName: profile.tradingName,
    scope: profile.scope,
  });

  const filePath = certificate.pdfPath ? certificatePdfDiskPath(certificate.pdfPath) : null;
  if (!filePath) throw notFound("Certificate PDF is not available yet.");

  await logPrivateFileAccess({
    actorId: req.user!.id,
    action: "member.certificate.pdf_access",
    entityType: "certificate",
    entityId: certificate.id,
  });

  applyPrivateFileHeaders(res, {
    contentType: "application/pdf",
    filename: `${certificate.number}.pdf`,
    disposition: "inline",
  });
  res.sendFile(filePath);
});

/* ---------------- Application tracker ---------------- */

memberRouter.get("/application", async (req, res) => {
  const member = await loadMember(req.user!.id);
  const application = member.applications[0] ?? null;
  res.json({
    application: serializeApplication(application),
    progress: await buildProgress(member),
  });
});

const agreementSchema = z.object({
  accepted: z.literal(true, { error: "must be true to accept the agreement" }),
  version: text(50),
});

memberRouter.post("/application/agreement", async (req, res) => {
  const { version } = agreementSchema.parse(req.body ?? {});
  const application = await getOrCreateDraftApplication(req.user!.id);
  if (application.status !== "draft" && application.status !== "needs_info") {
    throw conflict("This application can no longer change agreement acceptance.");
  }

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: { agreementAcceptedAt: new Date(), agreementVersion: version },
    select: applicationSelect,
  });
  res.json({ application: serializeApplication(updated) });
});

memberRouter.post("/application/submit", async (req, res) => {
  const member = await loadMember(req.user!.id);
  const progress = await buildProgress(member);

  if (!profileComplete(member.memberProfile)) {
    throw conflict("Complete your profile before submitting.", { fields: { profile: "is incomplete" } });
  }
  if (!documentsComplete(member.documents, member.memberProfile!.channels)) {
    throw conflict("Upload the required verification documents and confirm a trading channel before submitting.", {
      fields: { documents: "are incomplete" },
    });
  }

  const existing = member.applications[0] ?? null;
  if (existing && existing.status !== "draft" && existing.status !== "needs_info") {
    throw conflict("This application has already been submitted.");
  }
  if (!existing?.agreementAcceptedAt || !existing.agreementVersion) {
    throw conflict("Accept the membership agreement before submitting.", { fields: { agreement: "is required" } });
  }
  if (!progress.canSubmit) {
    throw conflict("This application is not ready to submit yet.");
  }

  const application = existing ?? (await getOrCreateDraftApplication(req.user!.id));
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      agreementAcceptedAt: existing?.agreementAcceptedAt ?? application.agreementAcceptedAt,
      agreementVersion: existing?.agreementVersion ?? application.agreementVersion,
    },
    select: applicationSelect,
  });
  res.status(existing ? 200 : 201).json({ application: serializeApplication(updated) });
});

/* ---------------- Documents ---------------- */

const DOCUMENT_TYPES = ["id_document", "proof_of_residence", "bank_evidence", "business_registration", "channel_evidence"] as const;

const uploadTypeSchema = z.object({
  type: z.enum(DOCUMENT_TYPES, { error: `must be one of: ${DOCUMENT_TYPES.join(", ")}` }),
});

async function storeDocument(userId: string, file: Express.Multer.File | undefined, type: DocumentType) {
  if (!file) throw badRequest("Choose a file to upload.");
  try {
    await assertFileSignature(file);
    await loadMember(userId);
    return await prisma.document.create({
      data: {
        userId,
        type,
        storagePath: file.filename,
        // Multer decodes the multipart filename as latin1; re-decode as utf8 for em dash etc.
        originalName: Buffer.from(file.originalname, "latin1").toString("utf8").slice(0, 180),
        status: "uploaded",
      },
      select: documentSelect,
    });
  } catch (error) {
    await unlink(file.path).catch(() => {});
    throw error;
  }
}

memberRouter.post("/documents", documentUpload.single("file"), async (req, res) => {
  const { type } = uploadTypeSchema.parse(req.body ?? {});
  const document = await storeDocument(req.user!.id, req.file, type);
  res.status(201).json({ document });
});

/** Aliases kept for older clients. */
memberRouter.post("/documents/id", documentUpload.single("file"), async (req, res) => {
  const document = await storeDocument(req.user!.id, req.file, "id_document");
  res.status(201).json({ document });
});

memberRouter.post("/documents/proof-of-residence", documentUpload.single("file"), async (req, res) => {
  const document = await storeDocument(req.user!.id, req.file, "proof_of_residence");
  res.status(201).json({ document });
});

memberRouter.get("/documents", async (req, res) => {
  const member = await loadMember(req.user!.id);
  res.json({ documents: member.documents });
});

memberRouter.get("/documents/:id/file", async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id },
  });
  if (!document) throw notFound("Document not found.");
  await logPrivateFileAccess({
    actorId: req.user!.id,
    action: "document.file_access",
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

memberRouter.delete("/documents/:id", async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: String(req.params.id), userId: req.user!.id },
  });
  if (!document) throw notFound("Document not found.");
  if (document.status === "accepted") throw forbidden("Accepted documents cannot be deleted.");

  await prisma.document.delete({ where: { id: document.id } });
  await removePrivateFile(document.storagePath);
  res.json({ ok: true });
});

/* ---------------- Trading channels ---------------- */

const channelCreateSchema = z
  .object({
    platform: text(50),
    handle: text(150).optional(),
    url: z.string().trim().refine(isHttpUrl, "must be a valid URL").optional(),
  })
  .refine((body) => Boolean(body.handle || body.url), { error: "Provide a handle or url." });

memberRouter.post("/channels", async (req, res) => {
  const body = channelCreateSchema.parse(req.body ?? {});
  const member = await loadMember(req.user!.id);
  const kind = body.platform.toLowerCase();
  const value = body.url ?? body.handle!;
  const existing = await prisma.channel.findFirst({
    where: { memberProfileId: member.memberProfile!.id, kind },
    select: { id: true },
  });

  // One channel row per platform — re-adding updates the value and resets confirmation.
  const channel = existing
    ? await prisma.channel.update({
        where: { id: existing.id },
        data: { value, status: "code_sent" },
        select: channelSelect,
      })
    : await prisma.channel.create({
        data: {
          memberProfileId: member.memberProfile!.id,
          kind,
          value,
          status: "code_sent",
        },
        select: channelSelect,
      });

  res.status(existing ? 200 : 201).json({ channel });
});

const channelConfirmSchema = z.object({
  code: z.string({ error: "is required" }).trim().regex(/^\d{6}$/, "must be the 6-digit code"),
});

memberRouter.post("/channels/:id/confirm", async (req, res) => {
  channelConfirmSchema.parse(req.body ?? {});
  const member = await loadMember(req.user!.id);
  const existing = await prisma.channel.findFirst({
    where: { id: String(req.params.id), memberProfileId: member.memberProfile!.id },
    select: { id: true, status: true },
  });
  if (!existing) throw notFound("Channel not found.");

  // TODO(V5): send a real channel verification code (SMS/DM) and match it here before launch.
  // Any well-formed 6-digit code confirms for local/UI testing only.
  const channel = await prisma.channel.update({
    where: { id: existing.id },
    data: { status: "confirmed" },
    select: channelSelect,
  });
  res.json({ channel });
});

const publicComplaintSelect = {
  id: true,
  referenceNumber: true,
  type: true,
  subjectLabel: true,
  status: true,
  description: true,
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
  appeals: {
    orderBy: { lodgedAt: "desc" as const },
    select: { id: true, lodgedAt: true, decidedAt: true, decision: true },
  },
} as const;

/** Cases naming this member (public-safe shape). Drafts are omitted. Newest first. */
memberRouter.get("/complaints", async (req, res) => {
  const member = await loadMember(req.user!.id);
  const rows = await prisma.complaint.findMany({
    where: { memberProfileId: member.memberProfile!.id, isDraft: false },
    orderBy: { createdAt: "desc" },
    select: publicComplaintSelect,
  });
  res.json({ complaints: rows.map((row) => serializePublicComplaint(row)) });
});

const memberComplaintResponseSchema = z.object({
  body: z.string({ error: "is required" }).trim().min(10, "must be at least 10 characters").max(5000),
});

/** Named member replies to a case that is waiting for their response. Optional files attach as evidence. */
memberRouter.post("/complaints/:id/response", (req, res, next) => {
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.includes("multipart/form-data")) {
    return complaintUpload.array("files", 5)(req, res, next);
  }
  return next();
}, async (req, res) => {
  const body = memberComplaintResponseSchema.parse(req.body ?? {});
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const member = await loadMember(req.user!.id);
  const profileId = member.memberProfile!.id;
  const raw = String(req.params.id ?? "").trim();

  try {
    for (const file of files) {
      file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      await assertFileSignature(file);
    }

    const complaint = await prisma.complaint.findFirst({
      where: raw.toUpperCase().startsWith("PSSA-C-")
        ? { referenceNumber: raw.toUpperCase(), memberProfileId: profileId }
        : { id: raw, memberProfileId: profileId },
      select: {
        id: true,
        status: true,
        isDraft: true,
        referenceNumber: true,
        type: true,
        description: true,
        subjectLabel: true,
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
    if (!complaint || complaint.isDraft) throw notFound("Complaint not found.");
    if (complaint.status !== "awaiting_member_response" && complaint.status !== "under_review") {
      throw conflict("This complaint is not waiting for a member response.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.complaintResponse.create({
        data: {
          complaintId: complaint.id,
          memberProfileId: profileId,
          body: body.body,
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
      return tx.complaint.update({
        where: { id: complaint.id },
        data: { status: "under_review" },
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
    });

    res.json({ complaint: serializePublicComplaint(updated) });
  } catch (error) {
    for (const file of files) {
      await removePrivateFile(file.filename).catch(() => {});
    }
    throw error;
  }
});
