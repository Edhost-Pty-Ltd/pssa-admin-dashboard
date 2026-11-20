import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

export class MailNotConfiguredError extends Error {}

let transporter: Transporter | null = null;

function missingSettings() {
  return [
    ["SMTP_HOST", config.mail.host],
    ["MAIL_FROM", config.mail.from],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function getTransporter() {
  const missing = missingSettings();
  if (missing.length) throw new MailNotConfiguredError(`Email is not set up: add ${missing.join(" and ")} to backend/.env.`);
  transporter ??= nodemailer.createTransport({
    host: config.mail.host!,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  await getTransporter().sendMail({ from: config.mail.from!, ...message });
}
