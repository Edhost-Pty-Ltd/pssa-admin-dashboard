import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ApplicationDocument, VerificationApplication, VerificationDecision } from "../types/admin";

const ACTIONS: Record<
  string,
  { decision: VerificationDecision; label: string; tone: "primary" | "outline" | "danger" }[]
> = {
  PENDING: [
    { decision: "UNDER_REVIEW", label: "Start review", tone: "outline" },
    { decision: "APPROVED", label: "Approve", tone: "primary" },
    { decision: "INFO_REQUIRED", label: "Request information", tone: "outline" },
    { decision: "REJECTED", label: "Reject", tone: "danger" },
  ],
  UNDER_REVIEW: [
    { decision: "APPROVED", label: "Approve", tone: "primary" },
    { decision: "INFO_REQUIRED", label: "Request information", tone: "outline" },
    { decision: "REJECTED", label: "Reject", tone: "danger" },
  ],
  INFO_REQUIRED: [{ decision: "REJECTED", label: "Reject", tone: "danger" }],
  VERIFIED: [
    { decision: "APPROVED", label: "Renew for 12 months", tone: "outline" },
    { decision: "SUSPENDED", label: "Suspend", tone: "danger" },
  ],
  SUSPENDED: [{ decision: "REINSTATED", label: "Reinstate", tone: "primary" }],
};

function GateRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-green-soft text-green-dark" : "bg-[#fff0ef] text-[#b42318]"
        }`}
      >
        <Icon name={ok ? "check" : "close"} size={11} />
      </span>
      <span className={ok ? "text-navy" : "font-semibold text-[#b42318]"}>{label}</span>
      {detail && <span className="ml-auto text-[11px] text-muted">{detail}</span>}
    </li>
  );
}

export default function VerificationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<VerificationApplication | null>(null);
  const [decision, setDecision] = useState<VerificationDecision | null>(null);
  const [reason, setReason] = useState("");
  const [checks, setChecks] = useState({
    identity: false,
    contact: false,
    qualifications: false,
    conduct: false,
    method: "",
  });
  const [busy, setBusy] = useState(false);
  const [docModal, setDocModal] = useState<ApplicationDocument | null>(null);
  const [docNote, setDocNote] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const load = async () => {
    if (!id) return;
    const res = await adminApi.getApplication(id);
    setApp(res.profile);
  };

  useEffect(() => {
    if (!id) return;
    void adminApi.getApplication(id).then((res) => setApp(res.profile));
  }, [id]);

  if (!app) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">Application not found.</p>
        <Link to="/admin/verifications" className="mt-3 inline-block text-sm font-semibold text-green-dark underline">
          Back to Verifications
        </Link>
      </div>
    );
  }

  const hasDoc = (type: string) => app.documents.some((d) => d.type === type && d.status === "ACCEPTED");
  const docsReady =
    hasDoc("id_document") &&
    (hasDoc("proof_of_residence") || hasDoc("business_registration")) &&
    hasDoc("bank_evidence");
  const channelReady = app.channels.some((c) => c.confirmed) || hasDoc("channel_evidence");
  const assessmentPassed = app.assessments.some((a) => a.passed);
  const failedAttempts = app.assessments.filter((a) => !a.passed).length;
  const contactReady = Boolean(app.emailVerifiedAt && app.phoneVerifiedAt && app.conductAcceptedAt);
  const isOnboarding = app.referenceCode === "ONBOARDING";
  const gatesReady =
    !isOnboarding &&
    (app.canRecordApproval !== undefined
      ? app.canRecordApproval
      : docsReady && assessmentPassed && contactReady);
  const submissionPercent = app.submissionCompletionPercent ?? app.completionPercent;

  const actions = ACTIONS[app.status] ?? [];
  const needsReason = decision === "INFO_REQUIRED" || decision === "REJECTED" || decision === "SUSPENDED";

  const reviewDoc = async (doc: ApplicationDocument, status: "ACCEPTED" | "REJECTED", note?: string) => {
    const updated = await adminApi.reviewApplicationDoc(app.id, doc.id, status, note);
    setApp(updated);
    setDocModal(null);
    setDocNote("");
    notify(status === "ACCEPTED" ? `${doc.label} accepted.` : `${doc.label} marked not accepted.`);
  };

  const toggleChannel = async (channelId: string) => {
    await adminApi.toggleApplicationChannel(app.id, channelId);
    await load();
  };

  const resetAssessment = async () => {
    const latestFailed = [...app.assessments].reverse().find((a) => !a.passed && a.submittedAt);
    if (!latestFailed) return;
    const updated = await adminApi.allowExamRetake(
      app.id,
      latestFailed.id,
      "Admin approved assessment retake after compliance review.",
    );
    setApp(updated);
    notify("Assessment retake approved.");
  };

  const decide = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const updated = await adminApi.recordVerificationDecision(
        app.id,
        decision,
        reason.trim() || undefined,
        decision === "APPROVED" ? { ...checks, method: checks.method || undefined } : undefined,
      );
      setApp(updated);
      setDecision(null);
      setReason("");
      notify(`Decision recorded: ${decision.replace("_", " ")}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white shadow-xl ring-1 ring-white/15">
          {toastMsg}
        </div>
      )}

      <PageHeader
        kicker={app.referenceCode}
        title={app.applicantName}
        description={`${app.businessName} · ${app.city}, ${app.province}`}
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/verifications")}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-navy hover:bg-soft"
          >
            Back to Queue
          </button>
        }
      />

      {app.statusFeedback && (
        <div className="rounded-2xl border border-[#f2d492] bg-[#fff5df] px-5 py-3.5 text-xs text-[#8a5a00]">
          <strong>Last feedback sent to applicant:</strong> {app.statusFeedback}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-navy">Admission Gates</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={submissionPercent === 100 ? "green" : "amber"}>
                  Applicant: {submissionPercent}% Submitted
                </Badge>
                <Badge tone={gatesReady ? "green" : "amber"}>
                  Activation: {app.completionPercent}%
                </Badge>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Identity &amp; Evidence</p>
                <ul className="mt-2.5 space-y-2">
                  <GateRow ok={hasDoc("id_document")} label="SA ID / Passport" />
                  <GateRow
                    ok={hasDoc("proof_of_residence") || hasDoc("business_registration")}
                    label="Address / CIPC"
                  />
                  <GateRow ok={hasDoc("bank_evidence")} label="Bank evidence" />
                  <GateRow ok={channelReady} label="Trading channel" />
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Contact &amp; Conduct</p>
                <ul className="mt-2.5 space-y-2">
                  <GateRow ok={Boolean(app.emailVerifiedAt)} label="Email verified" />
                  <GateRow ok={Boolean(app.phoneVerifiedAt)} label="Phone verified" />
                  <GateRow
                    ok={Boolean(app.conductAcceptedAt)}
                    label={`Code of Conduct${app.conductVersion ? ` v${app.conductVersion}` : ""}`}
                  />
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Tutorials &amp; Assessment</p>
                <ul className="mt-2.5 space-y-2">
                  <GateRow
                    ok={app.tutorialProgress.completed >= app.tutorialProgress.total}
                    label={`Tutorials (${app.tutorialProgress.completed}/${app.tutorialProgress.total})`}
                  />
                  <GateRow ok={assessmentPassed} label="Verification assessment" />
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-navy">Identity &amp; Supporting Documents</h2>
            <div className="space-y-3">
              {app.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-soft/45 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Icon name="file" size={18} className="text-navy" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{doc.label}</p>
                      <p className="text-xs text-muted">
                        {doc.fileName}
                        {doc.sizeBytes ? ` · ${Math.round(doc.sizeBytes / 1024)} KB` : ""} · Uploaded {doc.uploadedAt}
                      </p>
                      {doc.reviewerNote && <p className="mt-1 text-xs font-medium text-[#b42318]">{doc.reviewerNote}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={doc.status === "ACCEPTED" ? "green" : doc.status === "REJECTED" ? "red" : "amber"}>
                      {doc.status}
                    </Badge>
                    {doc.status !== "ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => reviewDoc(doc, "ACCEPTED")}
                        className="rounded-lg bg-green-soft p-2 text-green-dark transition hover:bg-green hover:text-white"
                        title="Accept document"
                        aria-label="Accept document"
                      >
                        <Icon name="check" size={14} />
                      </button>
                    )}
                    {doc.status !== "REJECTED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocNote("");
                          setDocModal(doc);
                        }}
                        className="rounded-lg bg-[#fff0ef] p-2 text-[#b42318] transition hover:bg-[#b42318] hover:text-white"
                        title="Mark not accepted"
                        aria-label="Mark not accepted"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Check each document against the applicant&apos;s name and photo; document reviews are logged for compliance.
            </p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-navy">Contact &amp; Conduct</h2>
              <ul className="space-y-3">
                <GateRow
                  ok={Boolean(app.emailVerifiedAt)}
                  label="Email verified"
                  detail={app.emailVerifiedAt ? app.emailVerifiedAt.slice(0, 10) : "Pending"}
                />
                <GateRow
                  ok={Boolean(app.phoneVerifiedAt)}
                  label="Phone verified"
                  detail={app.phoneVerifiedAt ? app.phoneVerifiedAt.slice(0, 10) : "Pending"}
                />
                <GateRow
                  ok={Boolean(app.conductAcceptedAt)}
                  label={`Code of Conduct${app.conductVersion ? ` v${app.conductVersion}` : ""}`}
                  detail={app.conductAcceptedAt ? app.conductAcceptedAt.slice(0, 10) : "Pending"}
                />
              </ul>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-navy">Conduct Assessment</h2>
                {failedAttempts >= 2 && (
                  <button
                    type="button"
                    onClick={resetAssessment}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-navy hover:bg-soft"
                  >
                    <Icon name="audit" size={13} />
                    Approve retake
                  </button>
                )}
              </div>
              {app.assessments.length === 0 ? (
                <p className="text-xs text-muted">No attempts yet.</p>
              ) : (
                <ul className="space-y-2.5 text-xs">
                  {app.assessments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-soft/60 px-3 py-2">
                      <span className="text-muted">{a.startedAt.slice(0, 10)}</span>
                      {a.submittedAt ? (
                        <Badge tone={a.passed ? "green" : "red"}>
                          {a.score}/{a.total} · {a.passed ? "Passed" : "Not passed"}
                        </Badge>
                      ) : (
                        <Badge tone="muted">In progress</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-navy">Trading Channels &amp; Specialty Profile</h2>
            <p className="text-sm leading-relaxed text-ink">{app.bio}</p>

            <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
              <div>
                <p className="font-bold uppercase tracking-wider text-muted">Experience</p>
                <p className="mt-1 font-medium text-navy">{app.yearsExperience} years · SA ID ••••{app.saIdLast4}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-muted">Service Areas</p>
                <p className="mt-1 font-medium text-navy">{app.serviceAreas.join(", ")}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-muted">Skills</p>
                <p className="mt-1 font-medium text-navy">{app.skills.join(", ")}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-muted">Languages</p>
                <p className="mt-1 font-medium text-navy">{app.languages.join(", ")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Declared Channels</p>
              {app.channels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-navy">{ch.platform}</p>
                    <p className="text-xs text-muted">{ch.handle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      ch.confirmed
                        ? "bg-green-soft text-green-dark"
                        : "border border-line bg-white text-navy hover:bg-soft"
                    }`}
                  >
                    <Icon name="check" size={14} />
                    {ch.confirmed ? "Confirmed" : "Confirm Channel"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <section className="rounded-2xl border border-line bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-navy">Decision</h2>
                <Badge tone={statusTone(app.status)}>{app.status.replace("_", " ")}</Badge>
              </div>

              {app.status === "VERIFIED" && app.certificateNumber && (
                <div className="mb-4 rounded-xl border border-green/25 bg-green-soft/60 p-3 text-xs text-green-dark">
                  <Icon name="shield" size={14} className="mr-1 inline" />
                  Certificate <strong>{app.certificateNumber}</strong>
                  {app.verificationExpiresAt ? ` · valid until ${app.verificationExpiresAt.slice(0, 10)}` : ""}
                </div>
              )}

              {app.status === "INFO_REQUIRED" && (
                <p className="mb-4 text-xs text-muted">Waiting for the shopper to update documents and resubmit.</p>
              )}

              <div className="flex flex-col gap-2">
                {actions.map((a) => {
                  const blockedApprove =
                    a.decision === "APPROVED" &&
                    app.status !== "VERIFIED" &&
                    !gatesReady;
                  const btnClass =
                    a.tone === "primary"
                      ? "bg-green text-white hover:bg-green-dark"
                      : a.tone === "danger"
                        ? "border border-[#f9c8c4] bg-[#fff0ef] text-[#b42318] hover:bg-[#ffe4e2]"
                        : "border border-line bg-white text-navy hover:bg-soft";
                  return (
                    <button
                      key={a.decision}
                      type="button"
                      disabled={blockedApprove}
                      onClick={() => {
                        setReason("");
                        setDecision(a.decision);
                      }}
                      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${btnClass}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>

              {actions.some((a) => a.decision === "APPROVED") &&
                app.status !== "VERIFIED" &&
                !gatesReady && (
                  <p className="mt-3 text-xs text-[#b42318]">
                    {isOnboarding
                      ? "Member is still completing onboarding and has not submitted their verification application yet."
                      : "Approval is blocked until every admission gate is met."}
                  </p>
                )}
            </section>

            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-navy">Decision History</h2>
              {app.decisions.length === 0 ? (
                <p className="text-xs text-muted">No decisions recorded yet.</p>
              ) : (
                <ol className="space-y-4 border-l border-line pl-4">
                  {app.decisions.map((d) => (
                    <li key={d.id} className="relative text-xs">
                      <span className="absolute top-1 -left-[1.3rem] h-2 w-2 rounded-full bg-green" />
                      <p className="font-bold text-navy">{d.decision.replace("_", " ")}</p>
                      {d.reason && <p className="mt-0.5 text-ink">{d.reason}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">
                        {d.reviewer} · {d.createdAt.slice(0, 10)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </aside>
      </div>

      {decision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-navy">
              {decision === "APPROVED"
                ? app.status === "VERIFIED"
                  ? "Renew verification"
                  : "Approve personal shopper"
                : decision === "INFO_REQUIRED"
                  ? "Request more information"
                  : decision === "REJECTED"
                    ? "Reject application"
                    : decision === "SUSPENDED"
                      ? "Suspend verification"
                      : decision === "REINSTATED"
                        ? "Reinstate shopper"
                        : "Start review"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {decision === "APPROVED"
                ? "Record the checks you performed. Approval issues a 12-month certificate and lists the shopper for customer verification."
                : needsReason
                  ? "The applicant will see your reasons. Be specific about what is needed or why."
                  : "Move this application into active compliance review."}
            </p>

            {decision === "APPROVED" && (
              <div className="mt-4 space-y-2.5 rounded-xl border border-line bg-soft/50 p-4 text-xs">
                <label className="flex items-start gap-2.5 text-navy">
                  <input
                    type="checkbox"
                    checked={checks.identity}
                    onChange={(e) => setChecks({ ...checks, identity: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-green"
                  />
                  <span>
                    <strong>Identity checked (required)</strong> — ID is valid, legible, and matches the applicant.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-navy">
                  <input
                    type="checkbox"
                    checked={checks.contact}
                    onChange={(e) => setChecks({ ...checks, contact: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-green"
                  />
                  <span>Contact &amp; trading channels confirmed</span>
                </label>
                <label className="flex items-start gap-2.5 text-navy">
                  <input
                    type="checkbox"
                    checked={checks.qualifications}
                    onChange={(e) => setChecks({ ...checks, qualifications: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-green"
                  />
                  <span>Bank &amp; experience evidence reviewed</span>
                </label>
                <label className="flex items-start gap-2.5 text-navy">
                  <input
                    type="checkbox"
                    checked={checks.conduct}
                    onChange={(e) => setChecks({ ...checks, conduct: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-green"
                  />
                  <span>Code of Conduct and assessment confirmed</span>
                </label>
                <input
                  type="text"
                  value={checks.method}
                  onChange={(e) => setChecks({ ...checks, method: e.target.value })}
                  placeholder="Check method (optional, e.g. Document inspection & channel check)"
                  className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-xs focus:border-green focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-navy">
                {needsReason ? "Reasons (shared with applicant, min 10 chars)" : "Note (optional)"}
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (needsReason && reason.trim().length < 10) || (decision === "APPROVED" && !checks.identity)}
                onClick={decide}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 ${
                  decision === "REJECTED" || decision === "SUSPENDED"
                    ? "bg-[#b42318] hover:bg-[#911c13]"
                    : "bg-green hover:bg-green-dark"
                }`}
              >
                {busy ? "Saving..." : "Record decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {docModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-navy">Document not accepted</h3>
            <p className="mt-1 text-xs text-muted">
              Explain the issue with <strong>{docModal.label}</strong> so the shopper can upload a replacement.
            </p>
            <textarea
              rows={3}
              value={docNote}
              onChange={(e) => setDocNote(e.target.value)}
              placeholder="e.g. Image too blurry to read the ID number..."
              maxLength={500}
              className="mt-4 w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocModal(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={docNote.trim().length < 5}
                onClick={() => reviewDoc(docModal, "REJECTED", docNote.trim())}
                className="rounded-xl bg-[#b42318] px-4 py-2 text-xs font-semibold text-white hover:bg-[#911c13] disabled:opacity-45"
              >
                Mark not accepted
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
