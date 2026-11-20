import type { Application, Channel, Document, MemberProfile } from "@prisma/client";

export type GateKey = "verification" | "exam" | "agreement" | "approval";

export type GateResult = {
  key: GateKey;
  label: string;
  passed: boolean;
  detail: string;
};

export type ActivationEvaluation = {
  canActivate: boolean;
  /** True when the application file may be marked approved (verification + agreement). */
  canRecordApproval: boolean;
  missing: string[];
  gates: GateResult[];
};

type GateInput = {
  application: Pick<Application, "agreementAcceptedAt" | "agreementVersion" | "status">;
  profile: Pick<MemberProfile, "id" | "memberStatus"> | null;
  documents: Array<Pick<Document, "type" | "status">>;
  channels: Array<Pick<Channel, "status">>;
  /** When exam models exist, pass whether the entrance exam was passed. */
  examPassed?: boolean | null;
  /** True when this request itself records a human approval with conflict declared. */
  recordingApproval?: boolean;
};

function latestByType(documents: GateInput["documents"]) {
  const latest = new Map<string, GateInput["documents"][number]>();
  for (const doc of documents) {
    if (!latest.has(doc.type)) latest.set(doc.type, doc);
  }
  return latest;
}

function verificationPassed(documents: GateInput["documents"], channels: GateInput["channels"]) {
  const latest = latestByType(documents);
  const accepted = (type: string) => latest.get(type)?.status === "accepted";
  const hasId = accepted("id_document");
  const hasAddressOrBiz = accepted("proof_of_residence") || accepted("business_registration");
  const hasBank = accepted("bank_evidence");
  const hasChannel =
    channels.some((channel) => channel.status === "confirmed") || accepted("channel_evidence");
  return {
    passed: hasId && hasAddressOrBiz && hasBank && hasChannel,
    detail: hasId && hasAddressOrBiz && hasBank && hasChannel
      ? "Required documents accepted and a trading channel confirmed"
      : "ID, address/registration, bank evidence and a confirmed channel (or channel evidence) must be accepted",
  };
}

/**
 * Evaluates the four Phase 1 activation gates.
 * Approve may record a decision without setting Active when exam (or other) gates are still open.
 * A fee flag is never considered here and must never set Active by itself.
 */
export function evaluateActivationGates(input: GateInput): ActivationEvaluation {
  const verification = verificationPassed(input.documents, input.channels);
  const agreementPassed = Boolean(input.application.agreementAcceptedAt && input.application.agreementVersion);
  const examPassed = input.examPassed === true;
  const approvalPassed = input.recordingApproval === true || input.application.status === "approved";

  const gates: GateResult[] = [
    {
      key: "verification",
      label: "Verification",
      passed: verification.passed,
      detail: verification.detail,
    },
    {
      key: "exam",
      label: "Entrance assessment",
      passed: examPassed,
      detail: examPassed
        ? "Entrance assessment passed"
        : "Entrance assessment must be passed before Active",
    },
    {
      key: "agreement",
      label: "Membership agreement",
      passed: agreementPassed,
      detail: agreementPassed ? `Agreement accepted (${input.application.agreementVersion})` : "Membership agreement has not been accepted",
    },
    {
      key: "approval",
      label: "Human approval",
      passed: approvalPassed,
      detail: approvalPassed ? "Recorded human approval with conflict declaration" : "A recorded approval with conflictDeclared is required",
    },
  ];

  const missing = gates.filter((gate) => !gate.passed).map((gate) => gate.key);
  const canRecordApproval = verification.passed && agreementPassed;
  const canActivate = missing.length === 0;

  return { canActivate, canRecordApproval, missing, gates };
}
