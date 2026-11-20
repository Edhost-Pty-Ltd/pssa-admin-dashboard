import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import type { OtpChannel } from "@prisma/client";
import { sendMail } from "./mailer.js";

export const OTP_SETTINGS = {
  length: 6,
  expiresInMinutes: 10,
  resendAfterSeconds: 30,
  maxAttempts: 5,
} as const;

export function generateOtp() {
  return String(randomInt(0, 10 ** OTP_SETTINGS.length)).padStart(OTP_SETTINGS.length, "0");
}

export const hashOtp = (code: string) => bcrypt.hash(code, 10);
export const otpMatches = (code: string, hash: string) => bcrypt.compare(code, hash);

/** "thandi@example.com" → "t•••@example.com", "082 123 4567" → "•••••••567" */
export function maskDestination(channel: OtpChannel, destination: string) {
  if (channel === "email") return destination.replace(/^(.)[^@]*(@.+)$/, "$1•••$2");
  const digits = destination.replace(/\D/g, "");
  return `${"•".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`;
}

/** Emails the code. The code is never logged or returned to the browser. */
export async function emailOtp(to: string, code: string) {
  const minutes = OTP_SETTINGS.expiresInMinutes;
  await sendMail({
    to,
    subject: `Your PSSA verification code: ${code}`,
    text: `Your PSSA verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't request it, you can ignore this email.`,
    html: [
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1f1d;max-width:480px">`,
      `<p>Your PSSA verification code is:</p>`,
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>`,
      `<p>It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.</p>`,
      `</div>`,
    ].join(""),
  });
}
