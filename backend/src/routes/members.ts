import { Router } from "express";
import { authLimiter } from "../lib/rateLimit.js";
import { createMember, memberRegistrationSchema, serializeUser } from "../lib/members.js";
import { issueSession } from "../middleware/auth.js";

/**
 * Legacy member registration route. Prefer passwordless OTP for the member portal.
 */
export const membersRouter = Router();

membersRouter.post("/register", authLimiter, async (req, res) => {
  const user = await createMember(memberRegistrationSchema.parse(req.body ?? {}));
  issueSession(res, user);
  res.status(201).json({ message: "Member registered successfully", user: serializeUser(user) });
});
