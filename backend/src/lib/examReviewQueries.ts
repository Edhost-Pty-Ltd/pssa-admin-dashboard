import { prisma } from "./prisma.js";

const RETAKE_WAIT_DAYS = 7;

/** 12 months from activation. Sets the dates only. It does not set the member to Active. */
export function membershipPeriod(activatedAt: Date) {
  const validFrom = new Date(activatedAt);
  const validUntil = new Date(activatedAt);
  validUntil.setUTCMonth(validUntil.getUTCMonth() + 12);
  return { validFrom, validUntil };
}

export async function storeMembershipPeriod(memberProfileId: string, activatedAt: Date) {
  const period = membershipPeriod(activatedAt);
  return prisma.memberProfile.update({
    where: { id: memberProfileId },
    data: { validFrom: period.validFrom, validUntil: period.validUntil },
  });
}

function johannesburgDate(date: Date) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return Date.UTC(year, month - 1, day);
}

function addCalendarDays(dayUtc: number, days: number) {
  const date = new Date(dayUtc);
  date.setUTCDate(date.getUTCDate() + days);
  return date.getTime();
}

/** Submitted attempts, newest first. */
export async function attemptHistory(memberProfileId: string, type?: "entrance" | "refresher") {
  const attempts = await prisma.examAttempt.findMany({
    where: { memberProfileId, submittedAt: { not: null }, ...(type ? { type } : {}) },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      type: true,
      score: true,
      percent: true,
      passed: true,
      criticalFailed: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
    },
  });
  return { attempts, attemptCount: attempts.length };
}

/** True when the member has a submitted, passed entrance attempt. */
export async function hasPassedEntranceExam(memberProfileId: string) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { memberProfileId, type: "entrance", passed: true, submittedAt: { not: null } },
    select: { id: true },
  });
  return Boolean(attempt);
}

/**
 * True when the member has a submitted, passed refresher attempt.
 * Pass `since` (renewal startedAt / window open) so an old refresher does not count for a new cycle.
 */
export async function hasPassedRefresherExam(memberProfileId: string, since?: Date | null) {
  const attempt = await prisma.examAttempt.findFirst({
    where: {
      memberProfileId,
      type: "refresher",
      passed: true,
      submittedAt: { not: null, ...(since ? { gte: since } : {}) },
    },
    select: { id: true },
  });
  return Boolean(attempt);
}

/** Whether a retake is allowed under the seven-day and two-fail rules. */
export async function retakeWindow(
  memberProfileId: string,
  now = new Date(),
  type: "entrance" | "refresher" = "entrance",
) {
  const { attempts } = await attemptHistory(memberProfileId, type);
  const latestFail = attempts.find((attempt) => attempt.passed === false);
  const failedCount = attempts.filter((attempt) => attempt.passed === false).length;
  const passed = attempts.some((attempt) => attempt.passed === true);

  if (passed) return { retakeOpen: false, failedCount, opensOn: null, reason: "passed" as const };

  if (failedCount >= 2 && latestFail?.submittedAt) {
    // Admin allow-retake unlocks one more attempt after the latest fail.
    const override = await prisma.auditLog.findFirst({
      where: {
        action: type === "refresher" ? "exam.allow_retake_refresher" : "exam.allow_retake",
        entityType: "member_profile",
        entityId: memberProfileId,
        createdAt: { gt: latestFail.submittedAt },
      },
      select: { id: true },
    });
    if (override) return { retakeOpen: true, failedCount, opensOn: null, reason: "open" as const };
    return { retakeOpen: false, failedCount, opensOn: null, reason: "locked" as const };
  }

  if (!latestFail?.submittedAt) return { retakeOpen: false, failedCount, opensOn: null, reason: "no_attempt" as const };

  const opensOn = new Date(addCalendarDays(johannesburgDate(latestFail.submittedAt), RETAKE_WAIT_DAYS));
  const retakeOpen = johannesburgDate(now) >= opensOn.getTime();
  return { retakeOpen, failedCount, opensOn, reason: retakeOpen ? ("open" as const) : ("waiting" as const) };
}
/** Completion of the active tutorial videos for the admin review screen. */
export async function tutorialCompletion(memberProfileId: string) {
  const videos = await prisma.tutorialVideo.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  const progress = await prisma.videoProgress.findMany({
    where: { memberProfileId, tutorialVideoId: { in: videos.map((video) => video.id) } },
    select: { tutorialVideoId: true, completed: true, completedAt: true },
  });
  const byVideo = new Map(progress.map((row) => [row.tutorialVideoId, row]));
  const lessons = videos.map((video) => {
    const row = byVideo.get(video.id);
    return { id: video.id, title: video.title, completed: row?.completed === true, completedAt: row?.completedAt ?? null };
  });
  const completedCount = lessons.filter((lesson) => lesson.completed).length;
  return {
    completedCount,
    total: lessons.length,
    complete: lessons.length > 0 && completedCount === lessons.length,
    lessons,
  };
}