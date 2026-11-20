import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateOtp, maskDestination, OTP_SETTINGS } from "./otp.js";

describe("auth OTP helpers", () => {
  it("generates a fixed-length numeric code", () => {
    const code = generateOtp();
    assert.equal(code.length, OTP_SETTINGS.length);
    assert.match(code, /^\d+$/);
  });

  it("masks email destinations without revealing the full address", () => {
    assert.equal(maskDestination("email", "thandi@example.com"), "t•••@example.com");
  });

  it("masks phone destinations", () => {
    const masked = maskDestination("phone", "0821234567");
    assert.ok(masked.endsWith("567"));
    assert.ok(masked.includes("•"));
    assert.ok(!masked.includes("082123"));
  });
});
