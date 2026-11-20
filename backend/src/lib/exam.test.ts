import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXAM_PASS_PERCENT, normalizeAnswers, publicQuestion, scoreAttempt } from "./exam.js";

describe("exam rules", () => {
  const questions = [
    { id: "q1", correctOptionId: "a", isCritical: false },
    { id: "q2", correctOptionId: "b", isCritical: true },
    { id: "q3", correctOptionId: "c", isCritical: false },
    { id: "q4", correctOptionId: "d", isCritical: false },
    { id: "q5", correctOptionId: "e", isCritical: false },
  ];

  it("passes at or above the pass mark when no critical misses and not overdue", () => {
    const answers = { q1: "a", q2: "b", q3: "c", q4: "d", q5: "e" };
    const result = scoreAttempt(questions, answers, false);
    assert.equal(result.percent, 100);
    assert.equal(result.passed, true);
    assert.equal(result.criticalFailed, false);
    assert.ok(result.percent >= EXAM_PASS_PERCENT);
  });

  it("fails when a critical question is wrong even if percent is high", () => {
    const answers = { q1: "a", q2: "wrong", q3: "c", q4: "d", q5: "e" };
    const result = scoreAttempt(questions, answers, false);
    assert.equal(result.percent, 80);
    assert.equal(result.criticalFailed, true);
    assert.equal(result.passed, false);
  });

  it("fails overdue attempts and marks criticalFailed", () => {
    const answers = { q1: "a", q2: "b", q3: "c", q4: "d", q5: "e" };
    const result = scoreAttempt(questions, answers, true);
    assert.equal(result.passed, false);
    assert.equal(result.criticalFailed, true);
  });

  it("normalizes both map and array answer shapes", () => {
    assert.deepEqual(normalizeAnswers({ q1: "a" }), { q1: "a" });
    assert.deepEqual(normalizeAnswers([{ questionId: "q1", optionId: "a" }]), { q1: "a" });
  });

  it("strips the answer key from public questions", () => {
    const publicQ = publicQuestion({
      id: "q1",
      prompt: "Example?",
      options: [{ id: "a", text: "One" }],
      isCritical: true,
      topic: "conduct",
      sortOrder: 1,
    });
    assert.equal("correctOptionId" in publicQ, false);
    assert.equal(publicQ.id, "q1");
  });
});
