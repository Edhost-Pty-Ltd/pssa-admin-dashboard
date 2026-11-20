import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidIdentityNumber, isValidPassportNumber, maskIdNumber } from "./members.js";
import { privateFilePath } from "./uploads.js";

describe("privacy filters", () => {
  it("masks SA ID numbers in API-facing helpers", () => {
    const masked = maskIdNumber("9001015800083");
    assert.ok(masked.includes("•") || masked.includes("*") || masked.slice(-4) === "0083");
    assert.notEqual(masked, "9001015800083");
  });

  it("validates identity numbers without exposing them", () => {
    assert.equal(isValidIdentityNumber("sa_id", "123"), false);
    assert.equal(isValidIdentityNumber("sa_id", "0000000000000"), false);
    assert.equal(isValidIdentityNumber("passport", "A1234567"), true);
    assert.equal(isValidPassportNumber("A1234567"), true);
    assert.equal(isValidPassportNumber("bad"), false);
  });

  it("resolves private files only under storage/private (basename strips traversal)", () => {
    const traversed = privateFilePath("../etc/passwd");
    const normalized = traversed.replace(/\\/g, "/");
    assert.ok(normalized.includes("/storage/private/"));
    assert.ok(normalized.endsWith("/passwd"));
    assert.ok(!normalized.includes("/etc/passwd"));

    const safe = privateFilePath("abc123.pdf");
    assert.ok(safe.replace(/\\/g, "/").endsWith("/storage/private/abc123.pdf"));
  });
});
