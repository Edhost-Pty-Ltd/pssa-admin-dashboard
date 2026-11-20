import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordSchema, verifyPasswordOrDummy } from "./password.js";

describe("auth password helpers", () => {
  it("accepts a strong password", () => {
    const parsed = passwordSchema.safeParse("Secret1!");
    assert.equal(parsed.success, true);
  });

  it("rejects passwords without a digit or letter", () => {
    assert.equal(passwordSchema.safeParse("abcdefgh").success, false);
    assert.equal(passwordSchema.safeParse("12345678").success, false);
  });

  it("rejects short passwords", () => {
    assert.equal(passwordSchema.safeParse("Ab1").success, false);
  });

  it("timing-safe dummy verify returns false when hash is missing", async () => {
    const ok = await verifyPasswordOrDummy("Secret1!", null);
    assert.equal(ok, false);
  });
});
