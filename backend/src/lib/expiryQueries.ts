import type { ReminderKind } from "@prisma/client";
import { prisma } from "./prisma.js";

const REMINDERS: { kind: ReminderKind; days: number }[] = [
  { kind: "days_60", days: 60 },
  { kind: "days_30", days: 30 },
  { kind: "days_7", days: 7 },
];

function daysBefore(validUntil: Date, days: number) {
  const due = new Date(validUntil);
  due.setUTCDate(due.getUTCDate() - days);
  return due;
}

/** Create the 60, 30, and 7 day points for members who still have a future validUntil. */
export async function syncReminderPoints(now = new Date()) {
  const members = await prisma.memberProfile.findMany({
    where: { memberStatus: "active", validUntil: { gt: now } },
    select: { id: true, validUntil: true },
  });

  let created = 0;
  for (const member of members) {
    if (!member.validUntil) continue;
    for (const reminder of REMINDERS) {
      const dueAt = daysBefore(member.validUntil, reminder.days);
      const row = await prisma.reminderPoint.upsert({
        where: { memberProfileId_kind_dueAt: { memberProfileId: member.id, kind: reminder.kind, dueAt } },
        create: { memberProfileId: member.id, kind: reminder.kind, dueAt },
        update: {},
      });
      if (row.createdAt.getTime() >= now.getTime() - 5000) created += 1;
    }
  }
  return { members: members.length, created };
}

/** Points Ryan can email: due, and not sent yet. */
export async function dueReminderPoints(now = new Date()) {
  return prisma.reminderPoint.findMany({
    where: { dueAt: { lte: now }, sentAt: null },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      kind: true,
      dueAt: true,
      member: { select: { id: true, firstName: true, lastName: true, validUntil: true, user: { select: { email: true } } } },
    },
  });
}

/**
 * Stored Active is not left in place after validUntil.
 * Also marks the active certificate expired and stores the expiry confirmation point.
 */
export async function expireDueMemberships(now = new Date()) {
  const due = await prisma.memberProfile.findMany({
    where: { memberStatus: "active", validUntil: { lte: now } },
    select: { id: true, validUntil: true },
  });

  for (const member of due) {
    await prisma.$transaction([
      prisma.memberProfile.update({ where: { id: member.id }, data: { memberStatus: "expired" } }),
      prisma.certificate.updateMany({ where: { memberProfileId: member.id, status: "active" }, data: { status: "expired" } }),
    ]);
    if (member.validUntil) {
      await prisma.reminderPoint.upsert({
        where: { memberProfileId_kind_dueAt: { memberProfileId: member.id, kind: "expiry_confirmation", dueAt: member.validUntil } },
        create: { memberProfileId: member.id, kind: "expiry_confirmation", dueAt: member.validUntil },
        update: {},
      });
    }
  }
  return { expired: due.length };
}