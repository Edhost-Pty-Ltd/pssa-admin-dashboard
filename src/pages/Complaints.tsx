import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";
import type { CaseDetailRecord, CaseOutcome, CaseRecord, CaseStatus } from "../types/admin";

const OUTCOMES: { value: CaseOutcome; label: string }[] = [
  { value: "no_breach", label: "No breach found" },
  { value: "corrective_action", label: "Corrective action required" },
  { value: "suspension", label: "Suspend membership" },
  { value: "revocation", label: "Revoke membership & certificate" },
];

export default function Complaints() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [detail, setDetail] = useState<CaseDetailRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CaseStatus>("INVESTIGATING");
  const [outcome, setOutcome] = useState<CaseOutcome>("no_breach");
  const [decisionReasons, setDecisionReasons] = useState("");
  const [appealDecision, setAppealDecision] = useState("upheld");
  const [appealReasons, setAppealReasons] = useState("");
  const [conflictOk, setConflictOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => adminApi.listCases().then(setCases);

  useEffect(() => {
    void adminApi.listCases().then(setCases);
  }, []);

  const openCase = async (c: CaseRecord) => {
    setSelected(c);
    setDetail(null);
    setNotes(c.resolutionNotes);
    setStatus(c.status);
    setDecisionReasons("");
    setAppealReasons("");
    setConflictOk(false);
    try {
      const d = await adminApi.getCaseDetail(c.id);
      setDetail(d);
    } catch (err) {
      notify(errorMessage(err));
    }
  };

  const saveStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.updateCase(selected.id, status, notes);
      setSelected(null);
      await load();
      notify("Case status updated.");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!selected || decisionReasons.trim().length < 10 || !conflictOk) return;
    setBusy(true);
    try {
      await adminApi.decideCase(selected.id, outcome, decisionReasons);
      setSelected(null);
      await load();
      notify("Formal compliance decision recorded.");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitAppealDecision = async () => {
    if (!selected || appealReasons.trim().length < 10 || !conflictOk) return;
    setBusy(true);
    try {
      await adminApi.decideCaseAppeal(selected.id, appealDecision, appealReasons);
      setSelected(null);
      await load();
      notify("Appeal decision recorded.");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openAppeal = detail?.appeals.find((a) => !a.decidedAt);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Consumer Protection"
        title="Cases & Safety Reports"
        description="Investigate policy breaches, scam alerts, and impersonation reports, inspect evidence, and record formal compliance outcomes."
      />

      {cases.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted">
          No safety cases or complaints reported yet.
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c, idx) => (
            <div
              key={c.id}
              style={{ animationDelay: `${idx * 50}ms` }}
              className="glass-card stagger-enter rounded-2xl p-5"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-navy">{c.caseNumber}</h2>
                    <Badge tone={statusTone(c.severity)}>{c.severity} SEVERITY</Badge>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Category: <strong className="text-navy">{c.category}</strong> · Reported by {c.reporterName} (
                    {c.reporterEmail || "No email"}) · Opened {c.openedAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openCase(c)}
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft"
                >
                  Review Case
                </button>
              </div>

              <p className="mt-3 text-sm text-ink">{c.summary}</p>
              <p className="mt-2 text-xs text-muted">
                Against: <strong className="text-navy">{c.againstMember}</strong>
                {c.reportedChannel ? ` · Channel: ${c.reportedChannel}` : ""}
              </p>
              {c.resolutionNotes && (
                <div className="mt-3 rounded-xl border border-line bg-soft px-3.5 py-2.5 text-xs text-navy">
                  <strong>Compliance Notes:</strong> {c.resolutionNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy">Case {selected.caseNumber}</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Against: {selected.againstMember} · {selected.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-line p-1.5 text-muted hover:text-navy"
                aria-label="Close case dialog"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {detail && (
              <div className="mt-4 space-y-4">
                {detail.evidence.length > 0 && (
                  <div className="rounded-xl border border-line bg-soft/40 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Submitted Evidence</p>
                    <ul className="mt-2 space-y-1.5">
                      {detail.evidence.map((ev) => (
                        <li key={ev.id} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-navy">{ev.originalName}</span>
                          <a
                            href={`/api/admin/complaints/${selected.id}/evidence/${ev.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-green-dark underline"
                          >
                            View file
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.responses.length > 0 && (
                  <div className="rounded-xl border border-line bg-soft/40 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Member Responses</p>
                    <div className="mt-2 space-y-2">
                      {detail.responses.map((r) => (
                        <div key={r.id} className="rounded-lg bg-white p-2.5 text-xs text-ink">
                          <p>{r.body}</p>
                          <p className="mt-1 text-[11px] text-muted">{r.createdAt.slice(0, 10)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={saveStatusUpdate} className="mt-5 space-y-3 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Investigation Status &amp; Note</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus)}
                  className="rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="ESCALATED">ESCALATED</option>
                </select>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl border border-line bg-soft px-4 py-2 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50"
                >
                  Save Investigation Note
                </button>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal compliance note..."
                className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
              />
            </form>

            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Record Formal Decision</p>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CaseOutcome)}
                className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                value={decisionReasons}
                onChange={(e) => setDecisionReasons(e.target.value)}
                placeholder="Written decision reasons (minimum 10 characters)..."
                className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
              />
              <label className="flex items-center gap-2 text-xs text-navy">
                <input
                  type="checkbox"
                  checked={conflictOk}
                  onChange={(e) => setConflictOk(e.target.checked)}
                  className="accent-green"
                />
                I declare no conflict of interest in this compliance decision.
              </label>
              <button
                type="button"
                disabled={busy || decisionReasons.trim().length < 10 || !conflictOk}
                onClick={submitDecision}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                Record Decision
              </button>
            </div>

            {openAppeal && (
              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#b42318]">Pending Appeal</p>
                <p className="rounded-lg bg-[#fff0ef] p-2.5 text-xs text-navy">{openAppeal.reason}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={appealDecision}
                    onChange={(e) => setAppealDecision(e.target.value)}
                    className="rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                  >
                    <option value="upheld">Appeal upheld (overturn)</option>
                    <option value="dismissed">Appeal dismissed (maintain)</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy || appealReasons.trim().length < 10 || !conflictOk}
                    onClick={submitAppealDecision}
                    className="rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-2 disabled:opacity-50"
                  >
                    Decide Appeal
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={appealReasons}
                  onChange={(e) => setAppealReasons(e.target.value)}
                  placeholder="Appeal decision reasons (minimum 10 characters)..."
                  className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
