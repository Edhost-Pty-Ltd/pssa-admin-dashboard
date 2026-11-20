/**
 * Loads the official 30-question entrance bank into ExamQuestion.
 * Does not create members or applicants. Safe to re-run (upserts by sortOrder 1–30).
 *
 *   npm run db:seed-exam
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Option = { id: string; text: string };
type BankQuestion = {
  sortOrder: number;
  topic: string;
  isCritical: boolean;
  prompt: string;
  options: Option[];
  correctOptionId: string;
};

function fail(message: string): never {
  console.error(`[seed-exam] ${message}`);
  process.exit(1);
}

function loadBank(): BankQuestion[] {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "exam-questions.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as BankQuestion[];
  if (!Array.isArray(raw) || raw.length !== 30) fail(`Expected exactly 30 questions in exam-questions.json (got ${raw?.length ?? 0}).`);

  const orders = new Set<number>();
  let critical = 0;
  for (const question of raw) {
    if (!question.prompt?.trim()) fail(`Question sortOrder ${question.sortOrder} is missing a prompt.`);
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`Question sortOrder ${question.sortOrder} needs at least two options.`);
    }
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      fail(`Question sortOrder ${question.sortOrder}: correctOptionId is not in options.`);
    }
    if (orders.has(question.sortOrder)) fail(`Duplicate sortOrder ${question.sortOrder}.`);
    orders.add(question.sortOrder);
    if (question.isCritical) critical += 1;
  }
  if (critical < 1) fail("At least one question must be marked isCritical.");
  return raw.sort((a, b) => a.sortOrder - b.sortOrder);
}

async function main() {
  const bank = loadBank();
  let created = 0;
  let updated = 0;

  for (const question of bank) {
    const existing = await prisma.examQuestion.findFirst({
      where: { sortOrder: question.sortOrder },
      select: { id: true },
    });

    const data = {
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
      isCritical: question.isCritical,
      topic: question.topic,
      isActive: true,
      sortOrder: question.sortOrder,
    };

    if (existing) {
      await prisma.examQuestion.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.examQuestion.create({ data });
      created += 1;
    }
  }

  const active = await prisma.examQuestion.count({ where: { isActive: true } });
  const critical = await prisma.examQuestion.count({ where: { isActive: true, isCritical: true } });
  console.log(`[seed-exam] Upserted bank: ${created} created, ${updated} updated.`);
  console.log(`[seed-exam] Active questions: ${active} (${critical} critical).`);
}

main()
  .catch((error) => {
    console.error("[seed-exam] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
