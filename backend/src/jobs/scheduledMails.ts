/**
 * Scheduled mail jobs (cron / Task Scheduler / host runner).
 * Run: npm run jobs:mails
 *
 * - Renewal reminders at 60 / 30 / 7 calendar days before validUntil
 * - Expiry confirmation when validUntil has passed (mail only; live status already uses the date)
 * - Complaint acknowledgement / decision deadline reminders for admins
 *
 * Dedupes via AuditLog actions so a re-run does not spam.
 */
import { addBusinessDays } from "../lib/businessDays.js";
import {
  alreadySent,
  notifyComplaintDeadline,
  notifyExpiryConfirmation,
  notifyRenewalReminder,
} from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";

function johannesburgYmd(date: Date) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year, month, day };
}

function startOfJohannesburgDay(date: Date) {
  const { year, month, day } = johannesburgYmd(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function addCalendarDays(from: Date, days: number) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function sameJohannesburgDay(a: Date, b: Date) {
  const left = johannesburgYmd(a);
  const right = johannesburgYmd(b);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

async function adminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  return admins.map((admin) => admin.email).filter(Boolean);
}

export async function runRenewalReminderMails(now = new Date()) {
  const targets: Array<60 | 30 | 7> = [60, 30, 7];
  let sent = 0;

  for (const daysBefore of targets) {
    const members = await prisma.memberProfile.findMany({
      where: {
        memberStatus: { in: ["active", "expired"] },
        validUntil: { not: null },
        user: { email: { not: "" } },
      },
      select: {
        id: true,
        validUntil: true,
        user: { select: { email: true } },
      },
    });

    for (const member of members) {
      if (!member.validUntil) continue;
      const reminderDay = addCalendarDays(startOfJohannesburgDay(member.validUntil), -daysBefore);
      if (!sameJohannesburgDay(reminderDay, now)) continue;

      const action = `mail.renewal.reminder_${daysBefore}`;
      if (await alreadySent(action, "member_profile", member.id)) continue;

      const result = await notifyRenewalReminder({
        to: member.user.email,
        daysBefore,
        validUntil: member.validUntil,
        memberProfileId: member.id,
      });
      if (result.sent) sent += 1;
    }
  }

  return { sent };
}

export async function runExpiryConfirmationMails(now = new Date()) {
  const members = await prisma.memberProfile.findMany({
    where: {
      validUntil: { lte: now },
      memberStatus: { in: ["active", "expired"] },
      user: { email: { not: "" } },
    },
    select: {
      id: true,
      validUntil: true,
      user: { select: { email: true } },
    },
  });

  let sent = 0;
  for (const member of members) {
    if (!member.validUntil) continue;
    // Confirm on the expiry calendar day (or later if the job missed a day — still once via audit dedupe).
    if (member.validUntil.getTime() > now.getTime()) continue;
    if (await alreadySent("mail.member.expired", "member_profile", member.id)) continue;

    const result = await notifyExpiryConfirmation({
      to: member.user.email,
      validUntil: member.validUntil,
      memberProfileId: member.id,
    });
    if (result.sent) sent += 1;
  }
  return { sent };
}

export async function runComplaintDeadlineMails(now = new Date()) {
  const admins = await adminEmails();
  if (!admins.length) return { sent: 0 };

  const complaints = await prisma.complaint.findMany({
    where: {
      isDraft: false,
      status: { in: ["received", "under_review", "awaiting_member_response"] },
    },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      decisionDueAt: true,
      reviewerId: true,
      reviewer: { select: { email: true } },
    },
  });

  let sent = 0;
  const warnWindowMs = 24 * 60 * 60 * 1000; // remind within 1 calendar day of due / overdue

  for (const complaint of complaints) {
    const recipients = new Set<string>();
    if (complaint.reviewer?.email) recipients.add(complaint.reviewer.email);
    for (const email of admins) recipients.add(email);

    // Acknowledgement target: createdAt + 2 business days, while still unacknowledged.
    if (!complaint.acknowledgedAt && complaint.status === "received") {
      const due = addBusinessDays(complaint.createdAt, 2);
      const overdue = due.getTime() < now.getTime();
      const approaching = !overdue && due.getTime() - now.getTime() <= warnWindowMs;
      if (overdue || approaching) {
        const action = `mail.complaint.deadline_acknowledgement${overdue ? "_overdue" : ""}`;
        if (!(await alreadySent(action, "complaint", complaint.id))) {
          for (const to of recipients) {
            const result = await notifyComplaintDeadline({
              to,
              kind: "acknowledgement",
              referenceNumber: complaint.referenceNumber,
              complaintId: complaint.id,
              dueAt: due,
              overdue,
            });
            if (result.sent) sent += 1;
          }
        }
      }
    }

    // Decision target: decisionDueAt (set when under_review), while not decided.
    if (complaint.decisionDueAt && complaint.status !== "decided") {
      const due = complaint.decisionDueAt;
      const overdue = due.getTime() < now.getTime();
      const approaching = !overdue && due.getTime() - now.getTime() <= warnWindowMs;
      if (overdue || approaching) {
        const action = `mail.complaint.deadline_decision${overdue ? "_overdue" : ""}`;
        if (!(await alreadySent(action, "complaint", complaint.id))) {
          for (const to of recipients) {
            const result = await notifyComplaintDeadline({
              to,
              kind: "decision",
              referenceNumber: complaint.referenceNumber,
              complaintId: complaint.id,
              dueAt: due,
              overdue,
            });
            if (result.sent) sent += 1;
          }
        }
      }
    }
  }

  return { sent };
}

export async function runAllScheduledMails(now = new Date()) {
  const renewal = await runRenewalReminderMails(now);
  const expiry = await runExpiryConfirmationMails(now);
  const complaints = await runComplaintDeadlineMails(now);
  return {
    renewalRemindersSent: renewal.sent,
    expiryConfirmationsSent: expiry.sent,
    complaintDeadlineMailsSent: complaints.sent,
  };
}
