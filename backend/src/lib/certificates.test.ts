import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveCertificateStatus, serializePublicCertificate } from "./certificates.js";

const certificate = {
  id: "c1",
  number: "PSSA-2026-000001",
  issuedAt: new Date("2026-01-01"),
  validFrom: new Date("2026-01-01"),
  validUntil: new Date("2027-01-01"),
  scope: "personal_shopper",
  qrTargetUrl: "/verify/PSSA-2026-000001",
  status: "active" as const,
  pdfPath: null,
  createdAt: new Date("2026-01-01"),
};

describe("live-check status", () => {
  it("shows active when membership and certificate are current", () => {
    const status = liveCertificateStatus(
      { memberStatus: "active", validUntil: new Date("2027-01-01") },
      certificate,
      new Date("2026-06-01"),
    );
    assert.equal(status, "active");
  });

  it("never shows active after validUntil even if stored status is still active", () => {
    const status = liveCertificateStatus(
      { memberStatus: "active", validUntil: new Date("2026-01-01") },
      { ...certificate, status: "active", validUntil: new Date("2026-01-01") },
      new Date("2026-06-01"),
    );
    assert.equal(status, "expired");
  });

  it("surfaces suspended / revoked / resigned over dates", () => {
    assert.equal(
      liveCertificateStatus({ memberStatus: "suspended", validUntil: new Date("2027-01-01") }, certificate),
      "suspended",
    );
    assert.equal(
      liveCertificateStatus({ memberStatus: "revoked", validUntil: new Date("2027-01-01") }, certificate),
      "revoked",
    );
    assert.equal(
      liveCertificateStatus({ memberStatus: "resigned", validUntil: new Date("2027-01-01") }, certificate),
      "resigned",
    );
  });

  it("public payload omits private identity/bank/address fields", () => {
    const payload = serializePublicCertificate({
      certificate,
      profile: {
        firstName: "Thandi",
        lastName: "Ndlovu",
        tradingName: "TN Sourcing",
        scope: "personal_shopper",
        memberStatus: "active",
        validUntil: new Date("2027-01-01"),
      },
      channels: [
        { kind: "instagram", value: "@thandi", status: "confirmed" },
        { kind: "instagram", value: "@draft", status: "code_sent" },
      ],
      now: new Date("2026-06-01"),
    });

    assert.equal(payload.number, "PSSA-2026-000001");
    assert.equal(payload.status, "active");
    assert.deepEqual(payload.channels, [{ kind: "instagram", value: "@thandi" }]);
    assert.equal("idNumber" in payload, false);
    assert.equal("physicalAddress" in payload, false);
    assert.equal("email" in payload, false);
    assert.equal("bank" in payload, false);
  });
});
