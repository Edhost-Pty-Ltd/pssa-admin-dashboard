import type { Response } from "express";
import { prisma } from "./prisma.js";

/**
 * Launch hardening for private storage:
 * - Files live only under backend/storage/private (never express.static)
 * - JSON never returns storagePath / public URLs
 * - Every download/stream is audited
 * - Responses are non-cacheable
 */

export function applyPrivateFileHeaders(
  res: Response,
  input: { contentType?: string; filename?: string; disposition?: "inline" | "attachment" },
) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (input.contentType) res.setHeader("Content-Type", input.contentType);
  if (input.filename) {
    const safe = input.filename.replace(/["\r\n]/g, "");
    const disposition = input.disposition ?? "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename="${safe}"`);
  }
}

export async function logPrivateFileAccess(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason ?? "private file access",
    },
  });
}
