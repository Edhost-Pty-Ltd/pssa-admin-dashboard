import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBusinessDays } from "./businessDays.js";

describe("complaint deadline business days", () => {
  it("skips Saturday and Sunday when adding business days", () => {
    // Friday 2026-11-13 → +1 business day = Monday 2026-11-16 (SAST noon UTC helper)
    const friday = new Date(Date.UTC(2026, 10, 13, 10, 0, 0));
    const next = addBusinessDays(friday, 1);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
    }).format(next);
    assert.equal(weekday, "Mon");
  });

  it("adds two business days for acknowledgement target", () => {
    const thursday = new Date(Date.UTC(2026, 10, 12, 10, 0, 0));
    const due = addBusinessDays(thursday, 2);
    const label = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(due);
    assert.equal(label, "2026-11-16");
  });

  it("adds ten business days for an appeal window starting mid-week", () => {
    const monday = new Date(Date.UTC(2026, 10, 16, 10, 0, 0));
    const due = addBusinessDays(monday, 10);
    const label = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(due);
    // 10 weekdays from Mon 16 Nov → Mon 30 Nov
    assert.equal(label, "2026-11-30");
  });
});
