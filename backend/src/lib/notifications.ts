import { MailNotConfiguredError, sendMail } from "./mailer.js";
import { prisma } from "./prisma.js";

type MailBody = { subject: string; text: string; html: string };

function wrapHtml(body: string) {
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1f1d;max-width:560px;line-height:1.5">`,
    body,
    `<p style="margin-top:24px;font-size:12px;color:#667">PSSA · Personal Shopper Standards Association</p>`,
    `</div>`,
  ].join("");
}

/** Never fail the API request because mail is down or misconfigured. */
export async function notifySafely(to: string | null | undefined, mail: MailBody, meta?: { action: string; entityType: string; entityId: string }) {
  if (!to) return { sent: false as const, reason: "no_recipient" as const };
  try {
    await sendMail({ to, ...mail });
    if (meta) {
      await prisma.auditLog.create({
        data: {
          action: meta.action,
          entityType: meta.entityType,
          entityId: meta.entityId,
          reason: `Email sent to ${to}: ${mail.subject}`,
        },
      }).catch(() => {});
    }
    return { sent: true as const };
  } catch (error) {
    const reason = error instanceof MailNotConfiguredError ? "mail_not_configured" : "send_failed";
    console.warn(`[mail] ${reason}:`, error instanceof Error ? error.message : error);
    return { sent: false as const, reason };
  }
}

export async function notifyApplicationDecision(input: {
  to: string;
  decision: "approved" | "rejected" | "needs_info";
  applicationNumber: string | null;
  activated: boolean;
  reason: string;
  applicationId: string;
}) {
  const number = input.applicationNumber ?? "your application";
  const subject =
    input.decision === "approved"
      ? input.activated
        ? `PSSA membership approved — ${number}`
        : `PSSA application approved (activation pending) — ${number}`
      : input.decision === "rejected"
        ? `PSSA application decision — ${number}`
        : `PSSA application needs information — ${number}`;

  const lead =
    input.decision === "approved"
      ? input.activated
        ? "Your membership has been activated. You can download your certificate from the member portal when signed in."
        : "Your application was approved, but membership is not Active yet. Remaining activation gates must still pass."
      : input.decision === "rejected"
        ? "Your application was not approved."
        : "A reviewer has asked for more information on your application.";

  const text = [
    lead,
    "",
    `Application: ${number}`,
    `Reviewer note: ${input.reason}`,
    "",
    "Sign in to the member portal for next steps.",
  ].join("\n");

  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(
        `<p>${lead}</p><p><strong>Application:</strong> ${number}</p><p><strong>Reviewer note:</strong> ${escapeHtml(input.reason)}</p><p>Sign in to the member portal for next steps.</p>`,
      ),
    },
    { action: `mail.application.${input.decision}`, entityType: "application", entityId: input.applicationId },
  );
}

export async function notifyMemberStatusChange(input: {
  to: string;
  status: string;
  reason: string;
  memberProfileId: string;
}) {
  const subject = `PSSA membership status update — ${input.status}`;
  const text = [
    `Your PSSA membership status is now: ${input.status}.`,
    "",
    `Reason: ${input.reason}`,
    "",
    "The live badge and public register reflect this status. Screenshots of old certificates are not proof of current membership.",
  ].join("\n");

  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(
        `<p>Your PSSA membership status is now: <strong>${escapeHtml(input.status)}</strong>.</p><p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p><p>The live badge and public register reflect this status. Screenshots of old certificates are not proof of current membership.</p>`,
      ),
    },
    { action: `mail.member.status_${input.status}`, entityType: "member_profile", entityId: input.memberProfileId },
  );
}

export async function notifyComplaintDecision(input: {
  complainantEmail: string | null;
  memberEmail: string | null;
  referenceNumber: string | null;
  outcome: string;
  reasons: string;
  appealDeadline: Date | null;
  complaintId: string;
}) {
  const ref = input.referenceNumber ?? "your complaint";
  const subject = `PSSA complaint decision — ${ref}`;
  const appealLine = input.appealDeadline
    ? `An appeal may be lodged before ${input.appealDeadline.toISOString().slice(0, 10)} (ten business days).`
    : "Appeal rules are described in the Complaints and Appeals policy.";
  const text = [
    `A decision has been recorded on complaint ${ref}.`,
    `Outcome: ${input.outcome}`,
    `Reasons: ${input.reasons}`,
    "",
    appealLine,
  ].join("\n");
  const html = wrapHtml(
    `<p>A decision has been recorded on complaint <strong>${escapeHtml(ref)}</strong>.</p><p><strong>Outcome:</strong> ${escapeHtml(input.outcome)}</p><p><strong>Reasons:</strong> ${escapeHtml(input.reasons)}</p><p>${escapeHtml(appealLine)}</p>`,
  );

  await notifySafely(input.complainantEmail, { subject, text, html }, {
    action: "mail.complaint.decision_complainant",
    entityType: "complaint",
    entityId: input.complaintId,
  });
  await notifySafely(input.memberEmail, { subject, text, html }, {
    action: "mail.complaint.decision_member",
    entityType: "complaint",
    entityId: input.complaintId,
  });
}

export async function notifyComplaintAppealDecision(input: {
  complainantEmail: string | null;
  memberEmail: string | null;
  referenceNumber: string | null;
  decision: string;
  reasons: string;
  complaintId: string;
}) {
  const ref = input.referenceNumber ?? "your complaint";
  const subject = `PSSA complaint appeal decision — ${ref}`;
  const text = [
    `An appeal decision has been recorded on complaint ${ref}.`,
    `Decision: ${input.decision}`,
    `Reasons: ${input.reasons}`,
  ].join("\n");
  const html = wrapHtml(
    `<p>An appeal decision has been recorded on complaint <strong>${escapeHtml(ref)}</strong>.</p><p><strong>Decision:</strong> ${escapeHtml(input.decision)}</p><p><strong>Reasons:</strong> ${escapeHtml(input.reasons)}</p>`,
  );
  await notifySafely(input.complainantEmail, { subject, text, html }, {
    action: "mail.complaint.appeal_complainant",
    entityType: "complaint",
    entityId: input.complaintId,
  });
  await notifySafely(input.memberEmail, { subject, text, html }, {
    action: "mail.complaint.appeal_member",
    entityType: "complaint",
    entityId: input.complaintId,
  });
}

export async function notifyRenewalDecision(input: {
  to: string;
  decision: "approved" | "rejected" | "needs_info";
  reason: string;
  validUntil?: Date | null;
  renewalId: string;
}) {
  const subject =
    input.decision === "approved"
      ? "PSSA renewal approved"
      : input.decision === "rejected"
        ? "PSSA renewal not approved"
        : "PSSA renewal needs information";
  const lead =
    input.decision === "approved"
      ? `Your renewal was approved.${input.validUntil ? ` Membership is valid until ${input.validUntil.toISOString().slice(0, 10)}.` : ""}`
      : input.decision === "rejected"
        ? "Your renewal was not approved."
        : "A reviewer has asked for more information on your renewal.";
  const text = [lead, "", `Reviewer note: ${input.reason}`].join("\n");
  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(`<p>${escapeHtml(lead)}</p><p><strong>Reviewer note:</strong> ${escapeHtml(input.reason)}</p>`),
    },
    { action: `mail.renewal.${input.decision}`, entityType: "renewal", entityId: input.renewalId },
  );
}

export async function notifyRenewalReminder(input: {
  to: string;
  daysBefore: 60 | 30 | 7;
  validUntil: Date;
  memberProfileId: string;
}) {
  const subject = `PSSA renewal reminder — ${input.daysBefore} days`;
  const until = input.validUntil.toISOString().slice(0, 10);
  const text = [
    `Your PSSA membership is due for renewal.`,
    `Valid until: ${until}`,
    `This is a ${input.daysBefore}-day reminder.`,
    "",
    "Sign in to the member portal to start renewal. Reminder emails are a service target; membership still ends on the valid-until date with no silent grace period.",
  ].join("\n");
  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(
        `<p>Your PSSA membership is due for renewal.</p><p><strong>Valid until:</strong> ${until}</p><p>This is a <strong>${input.daysBefore}-day</strong> reminder.</p><p>Sign in to the member portal to start renewal. Membership ends on the valid-until date with no silent grace period.</p>`,
      ),
    },
    { action: `mail.renewal.reminder_${input.daysBefore}`, entityType: "member_profile", entityId: input.memberProfileId },
  );
}

export async function notifyExpiryConfirmation(input: {
  to: string;
  validUntil: Date;
  memberProfileId: string;
}) {
  const until = input.validUntil.toISOString().slice(0, 10);
  const subject = "PSSA membership expired";
  const text = [
    `Your PSSA membership expired on ${until}.`,
    "The live badge and public register no longer show Active.",
    "You can start a renewal from the member portal if you are eligible.",
  ].join("\n");
  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(
        `<p>Your PSSA membership expired on <strong>${until}</strong>.</p><p>The live badge and public register no longer show Active.</p><p>You can start a renewal from the member portal if you are eligible.</p>`,
      ),
    },
    { action: "mail.member.expired", entityType: "member_profile", entityId: input.memberProfileId },
  );
}

export async function notifyComplaintDeadline(input: {
  to: string;
  kind: "acknowledgement" | "decision";
  referenceNumber: string | null;
  complaintId: string;
  dueAt: Date | null;
  overdue: boolean;
}) {
  const ref = input.referenceNumber ?? input.complaintId;
  const label = input.kind === "acknowledgement" ? "acknowledgement (2 business days)" : "decision (30 business days)";
  const subject = input.overdue
    ? `PSSA complaint overdue — ${label} — ${ref}`
    : `PSSA complaint deadline approaching — ${label} — ${ref}`;
  const due = input.dueAt ? input.dueAt.toISOString().slice(0, 10) : "see case";
  const text = [
    `Complaint ${ref} needs attention.`,
    `Deadline type: ${label}`,
    `Due: ${due}`,
    input.overdue ? "Status: OVERDUE" : "Status: approaching",
    "",
    "Open the admin complaints queue to review the case.",
  ].join("\n");
  return notifySafely(
    input.to,
    {
      subject,
      text,
      html: wrapHtml(
        `<p>Complaint <strong>${escapeHtml(ref)}</strong> needs attention.</p><p><strong>Deadline:</strong> ${escapeHtml(label)}</p><p><strong>Due:</strong> ${due}</p><p><strong>Status:</strong> ${input.overdue ? "OVERDUE" : "approaching"}</p>`,
      ),
    },
    {
      action: `mail.complaint.deadline_${input.kind}${input.overdue ? "_overdue" : ""}`,
      entityType: "complaint",
      entityId: input.complaintId,
    },
  );
}

export async function alreadySent(action: string, entityType: string, entityId: string) {
  const row = await prisma.auditLog.findFirst({
    where: { action, entityType, entityId },
    select: { id: true },
  });
  return Boolean(row);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
