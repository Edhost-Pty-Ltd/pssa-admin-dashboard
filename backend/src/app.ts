import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";
import { loadUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { membersRouter } from "./routes/members.js";
import { memberRouter } from "./routes/member.js";
import { memberRenewalRouter } from "./routes/memberRenewal.js";
import { adminRouter } from "./routes/admin.js";
import { adminMembersRouter } from "./routes/adminMembers.js";
import { adminComplaintsRouter } from "./routes/adminComplaints.js";
import { adminRenewalsRouter } from "./routes/adminRenewals.js";
import { adminOverviewRouter } from "./routes/adminOverview.js";
import { tutorialsRouter } from "./routes/tutorials.js";
import { examRouter } from "./routes/exam.js";
import { publicMembersRouter } from "./routes/publicMembers.js";
import { verifyRouter } from "./routes/verify.js";
import { complaintsRouter } from "./routes/complaints.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(loadUser);

  const api = express.Router();
  api.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: "connected" });
    } catch {
      res.status(503).json({ ok: false, database: "unreachable", error: "Database unreachable", errors: ["Database unreachable"] });
    }
  });
  api.use("/search", publicMembersRouter);
  api.use("/verify", verifyRouter);
  api.use("/complaints", complaintsRouter);
  api.use("/auth", authRouter);
  api.use("/members", membersRouter);
  api.use("/member", memberRouter);
  api.use("/member", memberRenewalRouter);
  api.use("/admin", adminRouter);
  api.use("/admin", adminOverviewRouter);
  api.use("/admin", adminMembersRouter);
  api.use("/admin", adminComplaintsRouter);
  api.use("/admin", adminRenewalsRouter);
  api.use("/tutorials", tutorialsRouter);
  api.use("/exam", examRouter);
  api.use(notFoundHandler);
  app.use("/api", api);

  app.use(errorHandler);
  return app;
}
