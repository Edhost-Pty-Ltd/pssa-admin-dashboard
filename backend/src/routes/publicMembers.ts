import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/http.js";
import { publicMemberCertificate, searchPublicMembers } from "../lib/publicRegisterQueries.js";

/**
 * Public member register (/api/search/members).
 * Live status is derived; pending applicants without a certificate are omitted.
 */
export const publicMembersRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

publicMembersRouter.get("/members", async (req, res) => {
  const { q, page, pageSize } = searchSchema.parse(req.query);
  res.json(await searchPublicMembers({ q, page, pageSize }));
});

publicMembersRouter.get("/members/:id", async (req, res) => {
  const certificate = await publicMemberCertificate(String(req.params.id ?? ""));
  if (!certificate) throw notFound("Member not found.");
  res.json({ certificate });
});
