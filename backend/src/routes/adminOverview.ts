import { Router } from "express";
import { adminOverview } from "../lib/adminOverview.js";
import { requireRole } from "../middleware/auth.js";

/**
 * Admin dashboard overview — thin aggregator over applications, members, and complaints.
 * Does not invent listings/customers; those arrays stay empty in Phase 1.
 */
export const adminOverviewRouter = Router();
adminOverviewRouter.use(requireRole("ADMIN"));

adminOverviewRouter.get("/overview", async (_req, res) => {
  res.json(await adminOverview());
});
