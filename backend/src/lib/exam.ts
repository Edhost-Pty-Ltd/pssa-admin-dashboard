import type { ExamAttempt, ExamQuestion, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export const EXAM_DURATION_MS = 45 * 60 * 1000;
export const EXAM_PASS_PERCENT = 80;
export const EXAM_QUESTION_COUNT = 30;

type QuestionOption = { id: string; text: string };

export type PublicExamQuestion = {
  id: string;
  prompt: string;
  options: QuestionOption[];
  isCritical: boolean;
  topic: string | null;
  sortOrder: number;
};

/** Strip the answer key before sending questions to a member. */
export function publicQuestion(question: Pick<ExamQuestion, "id" | "prompt" | "options" | "isCritical" | "topic" | "sortOrder">): PublicExamQuestion {
  const options = Array.isArray(question.options) ? (question.options as QuestionOption[]) : [];
  return {
    id: question.id,
    prompt: question.prompt,
    options: options.map((option) => ({ id: String(option.id), text: String(option.text) })),
    isCritical: question.isCritical,
    topic: question.topic,
    sortOrder: question.sortOrder,
  };
}

export function serializeAttempt(attempt: Pick<
  ExamAttempt,
  "id" | "type" | "score" | "percent" | "passed" | "criticalFailed" | "startedAt" | "expiresAt" | "submittedAt"
>) {
  return {
    id: attempt.id,
    type: attempt.type,
    score: attempt.score,
    percent: attempt.percent,
    passed: attempt.passed,
    criticalFailed: attempt.criticalFailed,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
  };
}

/** Pick up to 30 active questions (random order when more exist). */
export async function pickExamQuestions(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const active = await tx.examQuestion.findMany({
    where: { isActive: true },
    select: {
      id: true,
      prompt: true,
      options: true,
      correctOptionId: true,
      isCritical: true,
      topic: true,
      sortOrder: true,
    },
  });
  if (active.length === 0) return [];

  for (let i = active.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [active[i], active[j]] = [active[j]!, active[i]!];
  }
  return active.slice(0, EXAM_QUESTION_COUNT);
}

export type AnswerMap = Record<string, string>;

export function normalizeAnswers(raw: unknown): AnswerMap {
  const out: AnswerMap = {};
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const questionId = String((row as { questionId?: unknown }).questionId ?? "");
      const optionId = String((row as { optionId?: unknown }).optionId ?? "");
      if (questionId && optionId) out[questionId] = optionId;
    }
    return out;
  }
  if (raw && typeof raw === "object") {
    for (const [questionId, optionId] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof optionId === "string" && optionId.trim()) out[questionId] = optionId.trim();
    }
  }
  return out;
}

export function scoreAttempt(
  questions: Array<Pick<ExamQuestion, "id" | "correctOptionId" | "isCritical">>,
  answers: AnswerMap,
  overdue: boolean,
) {
  let score = 0;
  let criticalFailed = false;
  for (const question of questions) {
    const selected = answers[question.id];
    const correct = selected === question.correctOptionId;
    if (correct) score += 1;
    else if (question.isCritical) criticalFailed = true;
  }
  const total = questions.length || 1;
  const percent = Math.round((100 * score) / total);
  const passed = !overdue && percent >= EXAM_PASS_PERCENT && !criticalFailed;
  return { score, percent, passed, criticalFailed: overdue ? true : criticalFailed };
}
