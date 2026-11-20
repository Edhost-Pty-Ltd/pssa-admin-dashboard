import { createReadStream, existsSync, statSync } from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { applyPrivateFileHeaders, logPrivateFileAccess } from "../lib/privateFiles.js";
import { prisma } from "../lib/prisma.js";
import { assertVideoSignature, privateFilePath, removePrivateFile, videoUpload } from "../lib/uploads.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Tutorial listing, streaming, progress, and admin upload/activate.
 * Official catalogue is capped at four videos. Skip-ahead cannot mark a lesson complete.
 */
export const tutorialsRouter = Router();

const COMPLETE_RATIO = 0.95;
/** Max seconds a single progress report may advance maxPosition (anti skip-ahead). */
const MAX_JUMP_SECONDS = 5;
/** Senior provides four official conduct tutorials; admin may store at most that many. */
export const MAX_OFFICIAL_TUTORIALS = 4;

async function requireMemberProfileId(userId: string) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw notFound("Member profile not found.");
  return profile.id;
}

function mimeForVideo(storagePath: string) {
  const lower = storagePath.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

tutorialsRouter.get("/active", requireRole("MEMBER", "ADMIN"), async (req, res) => {
  const videos = await prisma.tutorialVideo.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      createdAt: true,
    },
  });

  let progressByVideo = new Map<
    string,
    { completed: boolean; completedAt: Date | null; watchedSeconds: number; maxPositionSeconds: number }
  >();

  if (req.user!.role === "MEMBER") {
    const profile = await prisma.memberProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (profile && videos.length) {
      const rows = await prisma.videoProgress.findMany({
        where: { memberProfileId: profile.id, tutorialVideoId: { in: videos.map((video) => video.id) } },
        select: {
          tutorialVideoId: true,
          completed: true,
          completedAt: true,
          watchedSeconds: true,
          maxPositionSeconds: true,
        },
      });
      progressByVideo = new Map(
        rows.map((row) => [
          row.tutorialVideoId,
          {
            completed: row.completed,
            completedAt: row.completedAt,
            watchedSeconds: row.watchedSeconds,
            maxPositionSeconds: row.maxPositionSeconds,
          },
        ]),
      );
    }
  }

  const tutorials = videos.map((video) => {
    const progress = progressByVideo.get(video.id);
    return {
      id: video.id,
      title: video.title,
      durationSeconds: video.durationSeconds,
      createdAt: video.createdAt,
      completed: progress?.completed === true,
      completedAt: progress?.completedAt ?? null,
      watchedSeconds: progress?.watchedSeconds ?? 0,
      maxPositionSeconds: progress?.maxPositionSeconds ?? 0,
    };
  });

  res.json({
    tutorials,
    ...(videos.length === 0
      ? { reason: "No active tutorials yet. Official lesson files are still outstanding." }
      : {}),
  });
});

tutorialsRouter.get("/:id/stream", requireRole("MEMBER", "ADMIN"), async (req, res) => {
  const video = await prisma.tutorialVideo.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, storagePath: true, isActive: true, title: true },
  });
  if (!video) throw notFound("Tutorial not found.");
  if (!video.isActive && req.user!.role !== "ADMIN") throw forbidden("That tutorial is not available yet.");

  const filePath = privateFilePath(video.storagePath);
  if (!existsSync(filePath)) throw notFound("That tutorial file is no longer available.");

  const stat = statSync(filePath);
  const mime = mimeForVideo(video.storagePath);
  const range = req.headers.range;

  // Log once per stream open (skip tiny mid-file range probes after the first byte).
  const rangeStart = range ? Number(/^bytes=(\d*)-/.exec(range)?.[1] || 0) : 0;
  if (!range || rangeStart === 0) {
    await logPrivateFileAccess({
      actorId: req.user!.id,
      action: "tutorial.stream_access",
      entityType: "tutorial_video",
      entityId: video.id,
      reason: video.title,
    });
  }

  applyPrivateFileHeaders(res, { contentType: mime });

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) throw badRequest("Invalid Range header.");
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : Math.min(start + 1024 * 1024 - 1, stat.size - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= stat.size || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", String(end - start + 1));
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Accept-Ranges", "bytes");
  createReadStream(filePath).pipe(res);
});

const progressSchema = z.object({
  positionSeconds: z.coerce.number().finite().min(0, "must be zero or greater"),
  durationSeconds: z.coerce.number().finite().positive().optional(),
});

tutorialsRouter.post("/:id/progress", requireRole("MEMBER"), async (req, res) => {
  const body = progressSchema.parse(req.body ?? {});
  const video = await prisma.tutorialVideo.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, isActive: true, durationSeconds: true },
  });
  if (!video) throw notFound("Tutorial not found.");
  if (!video.isActive) throw forbidden("That tutorial is not available yet.");

  const memberProfileId = await requireMemberProfileId(req.user!.id);
  const existing = await prisma.videoProgress.findUnique({
    where: { memberProfileId_tutorialVideoId: { memberProfileId, tutorialVideoId: video.id } },
  });

  const position = Math.floor(body.positionSeconds);
  const prevMax = existing?.maxPositionSeconds ?? 0;
  const nextMax = Math.max(prevMax, Math.min(position, prevMax + MAX_JUMP_SECONDS));
  const watchedSeconds = Math.max(existing?.watchedSeconds ?? 0, nextMax);
  const duration = body.durationSeconds
    ? Math.floor(body.durationSeconds)
    : (video.durationSeconds ?? existing?.maxPositionSeconds ?? null);

  if (body.durationSeconds && (!video.durationSeconds || body.durationSeconds > video.durationSeconds)) {
    await prisma.tutorialVideo.update({
      where: { id: video.id },
      data: { durationSeconds: Math.floor(body.durationSeconds) },
    });
  }

  const threshold = duration ? Math.floor(duration * COMPLETE_RATIO) : null;
  const alreadyComplete = existing?.completed === true;
  const completed = alreadyComplete || (threshold !== null && nextMax >= threshold);
  const now = new Date();

  const progress = await prisma.videoProgress.upsert({
    where: { memberProfileId_tutorialVideoId: { memberProfileId, tutorialVideoId: video.id } },
    create: {
      memberProfileId,
      tutorialVideoId: video.id,
      watchedSeconds,
      maxPositionSeconds: nextMax,
      lastPositionSeconds: position,
      lastReportedAt: now,
      completed,
      completedAt: completed ? now : null,
    },
    update: {
      watchedSeconds,
      maxPositionSeconds: nextMax,
      lastPositionSeconds: position,
      lastReportedAt: now,
      ...(completed && !alreadyComplete ? { completed: true, completedAt: now } : {}),
    },
    select: {
      id: true,
      tutorialVideoId: true,
      watchedSeconds: true,
      maxPositionSeconds: true,
      lastPositionSeconds: true,
      completed: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  res.json({ progress });
});

tutorialsRouter.use(requireRole("ADMIN"));

tutorialsRouter.get("/", async (_req, res) => {
  const tutorials = await prisma.tutorialVideo.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      isActive: true,
      storagePath: true,
      uploadedById: true,
      createdAt: true,
    },
  });
  const count = tutorials.length;
  res.json({
    tutorials,
    limit: MAX_OFFICIAL_TUTORIALS,
    count,
    remaining: Math.max(0, MAX_OFFICIAL_TUTORIALS - count),
  });
});

tutorialsRouter.post("/", videoUpload.single("file"), async (req, res) => {
  const title = z.string().trim().min(1, "is required").max(200).parse(req.body?.title ?? "");
  const durationSeconds = req.body?.durationSeconds
    ? z.coerce.number().int().positive().parse(req.body.durationSeconds)
    : undefined;
  if (!req.file) throw badRequest("Upload a video file.", { fields: { file: "is required" } });

  try {
    const existingCount = await prisma.tutorialVideo.count();
    if (existingCount >= MAX_OFFICIAL_TUTORIALS) {
      throw conflict(
        `Only ${MAX_OFFICIAL_TUTORIALS} official tutorial videos can be stored. Remove one before uploading another.`,
        { fields: { file: "catalogue is full" }, limit: MAX_OFFICIAL_TUTORIALS, count: existingCount },
      );
    }

    await assertVideoSignature(req.file);
    const tutorial = await prisma.tutorialVideo.create({
      data: {
        title,
        storagePath: req.file.filename,
        durationSeconds: durationSeconds ?? null,
        isActive: false,
        uploadedById: req.user!.id,
      },
      select: {
        id: true,
        title: true,
        durationSeconds: true,
        isActive: true,
        storagePath: true,
        uploadedById: true,
        createdAt: true,
      },
    });
    const count = existingCount + 1;
    res.status(201).json({
      tutorial,
      limit: MAX_OFFICIAL_TUTORIALS,
      count,
      remaining: Math.max(0, MAX_OFFICIAL_TUTORIALS - count),
    });
  } catch (error) {
    await removePrivateFile(req.file.filename).catch(() => {});
    throw error;
  }
});

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    durationSeconds: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: "Provide at least one field to update." });

tutorialsRouter.patch("/:id", async (req, res) => {
  const body = patchSchema.parse(req.body ?? {});
  const existing = await prisma.tutorialVideo.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!existing) throw notFound("Tutorial not found.");

  const tutorial = await prisma.tutorialVideo.update({
    where: { id: existing.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      isActive: true,
      storagePath: true,
      uploadedById: true,
      createdAt: true,
    },
  });
  res.json({ tutorial });
});

tutorialsRouter.post("/:id/activate", async (req, res) => {
  const existing = await prisma.tutorialVideo.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!existing) throw notFound("Tutorial not found.");

  const tutorial = await prisma.tutorialVideo.update({
    where: { id: existing.id },
    data: { isActive: true },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      isActive: true,
      storagePath: true,
      uploadedById: true,
      createdAt: true,
    },
  });
  res.json({ tutorial });
});

/** Remove a stored lesson so admin can replace a bad upload within the four-video cap. */
tutorialsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.tutorialVideo.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, storagePath: true },
  });
  if (!existing) throw notFound("Tutorial not found.");

  await prisma.tutorialVideo.delete({ where: { id: existing.id } });
  await removePrivateFile(existing.storagePath).catch(() => {});

  const count = await prisma.tutorialVideo.count();
  res.json({
    ok: true,
    limit: MAX_OFFICIAL_TUTORIALS,
    count,
    remaining: Math.max(0, MAX_OFFICIAL_TUTORIALS - count),
  });
});
