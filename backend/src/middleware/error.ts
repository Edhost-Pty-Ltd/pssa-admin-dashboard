import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/http.js";

/**
 * Every error response has the same shape:
 *   { error: string, errors: string[], fields?: Record<string, string> }
 * `errors` entries start with the field name ("email must be a valid email address"),
 * which is the format the frontend's registration form already maps onto its fields.
 */
function send(res: Response, status: number, error: string, fields?: Record<string, string>, extra?: Record<string, unknown>) {
  const errors = fields && Object.keys(fields).length ? Object.entries(fields).map(([key, message]) => `${key} ${message}`) : [error];
  res.status(status).json({ error, errors, ...(fields ? { fields } : {}), ...extra });
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, `Route not found: ${req.method} ${req.path}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    const details = err.details as { fields?: Record<string, string>; activation?: unknown } | undefined;
    const extra = details?.activation !== undefined ? { activation: details.activation } : undefined;
    return send(res, err.status, err.message, details?.fields, extra);
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      if (!fields[key]) fields[key] = issue.message;
    }
    return send(res, 400, "Please check the highlighted fields.", fields);
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "That file is too large. Documents can be up to 8 MB and videos up to 200 MB." : err.message;
    return send(res, 400, message);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return send(res, 409, "That record already exists.");
    if (err.code === "P2025") return send(res, 404, "Record not found.");
  }
  if (err instanceof SyntaxError && "body" in err) {
    return send(res, 400, "Malformed JSON body.");
  }
  console.error(err);
  send(res, 500, "Something went wrong on our side. Please try again.");
}
