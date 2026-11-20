import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { badRequest, HttpError, unauthorized } from "../lib/http.js";
import { MailNotConfiguredError } from "../lib/mailer.js";
import { emailOtp, generateOtp, hashOtp, maskDestination, OTP_SETTINGS, otpMatches } from "../lib/otp.js";
import { verifyPasswordOrDummy } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { authLimiter } from "../lib/rateLimit.js";
import {
  createCustomer,
  createMember,
  customerRegistrationSchema,
  findOrCreatePasswordlessMember,
  memberRegistrationSchema,
  serializeUser,
  signUpRoleSchema,
  userSelect,
} from "../lib/members.js";
import { clearSession, issueSession } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * POST /api/auth/register — public sign-up. `role` is "MEMBER" (default) or "CUSTOMER";
 * admin accounts can't be created here. Signs the new user in.
 * Member portal sign-in should use passwordless OTP instead of this route.
 */
authRouter.post("/register", authLimiter, async (req, res) => {
  const { role } = signUpRoleSchema.parse(req.body ?? {});
  const user =
    role === "CUSTOMER" ? await createCustomer(customerRegistrationSchema.parse(req.body)) : await createMember(memberRegistrationSchema.parse(req.body));
  issueSession(res, user);
  res.status(201).json({ message: role === "CUSTOMER" ? "Customer registered successfully" : "Member registered successfully", user: serializeUser(user) });
});

const loginSchema = z.object({
  email: z.string({ error: "is required" }).trim().toLowerCase().min(1, "is required"),
  password: z.string({ error: "is required" }).min(1, "is required"),
});

/** POST /api/auth/login — password sign-in for ADMIN (and any account that still has a password). */
authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const account = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const valid = await verifyPasswordOrDummy(password, account?.passwordHash);
  if (!account || !valid) throw unauthorized("Incorrect email or password.");
  const user = await prisma.user.update({ where: { id: account.id }, data: { lastLoginAt: new Date() }, select: userSelect });
  issueSession(res, user);
  res.json({ user: serializeUser(user) });
});

/**
 * POST /api/auth/logout — ends the session. Clears the cookie and bumps tokenVersion,
 * so any copy of the token (other tabs or devices) stops working too. Safe to call when signed out.
 */
authRouter.post("/logout", async (req, res) => {
  if (req.user) {
    await prisma.user.update({ where: { id: req.user.id }, data: { tokenVersion: { increment: 1 } } });
  }
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: userSelect });
  res.json({ user: user ? serializeUser(user) : null });
});

/* ---------------- Public passwordless member OTP ---------------- */

const emailSchema = z
  .string({ error: "is required" })
  .trim()
  .toLowerCase()
  .min(1, "is required")
  .pipe(z.email("must be a valid email address"));

const sendOtpSchema = z.object({
  email: emailSchema,
  channel: z.enum(["email", "phone"], { error: 'must be "email" or "phone"' }).optional().default("email"),
});

const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string({ error: "is required" }).trim().regex(/^\d{6}$/, "must be the 6-digit code"),
});

function fakeExpiresAt() {
  return new Date(Date.now() + OTP_SETTINGS.expiresInMinutes * 60_000);
}

/**
 * POST /api/auth/otp/send — public send-code for passwordless member sign-in.
 * Body: `{ email }` (optional `channel: "email"`). Phone returns 400 until SMS exists.
 * Does not reveal whether the email is already registered.
 */
authRouter.post("/otp/send", authLimiter, async (req, res) => {
  const { email, channel } = sendOtpSchema.parse(req.body ?? {});
  if (channel === "phone") {
    throw badRequest("Phone verification isn't available yet. Please use email instead.", {
      fields: { channel: "phone verification isn't available yet" },
    });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  // Admin (and non-member) accounts use password login. Same response shape so we don't leak role.
  // Do not create a MEMBER row here — accounts are created only after a correct verify.
  if (existing && existing.role !== "MEMBER") {
    return res.json({
      sent: true,
      destination: maskDestination("email", email),
      expiresAt: fakeExpiresAt(),
    });
  }

  const recent = await prisma.otpCode.findFirst({
    where: { email, channel: "email", createdAt: { gt: new Date(Date.now() - OTP_SETTINGS.resendAfterSeconds * 1000) } },
    select: { id: true },
  });
  if (recent) {
    throw badRequest(`Please wait ${OTP_SETTINGS.resendAfterSeconds} seconds before requesting another code.`);
  }

  const code = generateOtp();
  const expiresAt = fakeExpiresAt();
  const [, created] = await prisma.$transaction([
    prisma.otpCode.deleteMany({ where: { email, channel: "email", consumedAt: null } }),
    prisma.otpCode.create({
      data: { email, channel: "email", codeHash: await hashOtp(code), expiresAt },
      select: { id: true },
    }),
  ]);

  let mailSent = false;
  try {
    await emailOtp(email, code);
    mailSent = true;
  } catch (error) {
    if (error instanceof MailNotConfiguredError && !config.isProd) {
      console.warn(`[mail] SMTP not configured — OTP for ${maskDestination("email", email)}: ${code}`);
    } else {
      await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => {});
      console.error("[mail] Could not send the verification email:", error instanceof MailNotConfiguredError ? error.message : error);
      throw new HttpError(503, "We couldn't send the email. Please try again in a moment.");
    }
  }

  const body: { sent: true; destination: string; expiresAt: Date; devCode?: string } = {
    sent: true,
    destination: maskDestination("email", email),
    expiresAt,
  };
  // Local/dev only when mail did not leave the box — never in production.
  if (!config.isProd && !mailSent) body.devCode = code;

  res.json(body);
});

/**
 * POST /api/auth/otp/verify — public verify-code. Correct code signs the member in
 * (creates/resumes MEMBER session, sets `ec_session`, stamps emailVerifiedAt).
 */
authRouter.post("/otp/verify", authLimiter, async (req, res) => {
  const { email, code } = verifyOtpSchema.parse(req.body ?? {});

  const record = await prisma.otpCode.findFirst({
    where: { email, channel: "email", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) {
    throw badRequest("That code has expired. Request a new one.", { fields: { code: "has expired" } });
  }
  if (record.attempts >= OTP_SETTINGS.maxAttempts) {
    throw badRequest("Too many incorrect attempts. Request a new code.", { fields: { code: "has had too many attempts" } });
  }
  if (!(await otpMatches(code, record.codeHash))) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw badRequest("That code is incorrect.", { fields: { code: "is incorrect" } });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing && existing.role !== "MEMBER") {
    throw badRequest("That code is incorrect.", { fields: { code: "is incorrect" } });
  }

  const account = existing ?? (await findOrCreatePasswordlessMember(email));
  const now = new Date();
  const [, user] = await prisma.$transaction([
    prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: now } }),
    prisma.user.update({
      where: { id: account.id },
      data: { emailVerifiedAt: now, lastLoginAt: now },
      select: userSelect,
    }),
  ]);

  issueSession(res, user);
  res.json({ user: serializeUser(user) });
});
