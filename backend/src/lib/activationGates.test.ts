import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateActivationGates } from "./activationGates.js";

const docs = [
  { type: "id_document" as const, status: "accepted" as const },
  { type: "proof_of_residence" as const, status: "accepted" as const },
  { type: "bank_evidence" as const, status: "accepted" as const },
];
const channels = [{ status: "confirmed" as const }];

describe("approval gates", () => {
  it("does not activate when only verification and agreement pass (exam still missing)", () => {
    const result = evaluateActivationGates({
      application: {
        agreementAcceptedAt: new Date(),
        agreementVersion: "Policy-01",
        status: "submitted",
      },
      profile: { id: "m1", memberStatus: null },
      documents: docs,
      channels,
      examPassed: false,
      recordingApproval: true,
    });
    assert.equal(result.canRecordApproval, true);
    assert.equal(result.canActivate, false);
    assert.ok(result.missing.includes("exam"));
  });

  it("activates only when verification, exam, agreement and approval all pass", () => {
    const result = evaluateActivationGates({
      application: {
        agreementAcceptedAt: new Date(),
        agreementVersion: "Policy-01",
        status: "submitted",
      },
      profile: { id: "m1", memberStatus: null },
      documents: docs,
      channels,
      examPassed: true,
      recordingApproval: true,
    });
    assert.equal(result.canActivate, true);
    assert.deepEqual(result.missing, []);
  });

  it("never treats a fee flag as a gate (fee is absent from evaluation)", () => {
    const result = evaluateActivationGates({
      application: {
        agreementAcceptedAt: new Date(),
        agreementVersion: "Policy-01",
        status: "submitted",
      },
      profile: { id: "m1", memberStatus: null },
      documents: docs,
      channels,
      examPassed: true,
      recordingApproval: true,
    });
    assert.equal(
      result.gates.some((gate) => /fee|payment/i.test(gate.key) || /fee|payment/i.test(gate.label)),
      false,
    );
  });
});
