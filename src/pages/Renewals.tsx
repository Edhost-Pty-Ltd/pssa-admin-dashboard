import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";
import type { RenewalChecklistItem, RenewalRecord } from "../types/admin";

export default function Renewals() {
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [filter, setFilter] = useState<"ALL" | RenewalRecord["status"]>("ALL");
  const [selected, setSelected] = useState<RenewalRecord | null>(null);
  const [checklist, setChecklist] = useState<RenewalChecklistItem[]>([]);
  const [decision, setDecision] = useState<"approved" | "needs_info" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const [conflictOk, setConflictOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => adminApi.listRenewals().then(setRenewals);

  useEffect(() => {
    void adminApi.listRenewals().then(setRenewals);
  }, []);

  const openRenewal = async (r: RenewalRecord) => {
    setSelected(r);
    setChecklist([]);
    setReason("");
    setConflictOk(false);
    try {
      const detail = await adminApi.getRenewalDetail(r.id);
      setChecklist(detail.checklist);
    } catch (err) {
      notify(errorMessage(err));
    }
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || reason.trim().length < 10 || !conflictOk) return;
    setBusy(true);
    try {
      await adminApi.decideRenewal(selected.id, decision, reason);
      setSelected(null);
      await load();
      notify(`Renewal ${decision.replace("_", " ")}.`);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const visible = renewals.filter((r) => filter === "ALL" || r.status === filter);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Annual Accreditation"
        title="Membership Renewals"
        description="Review annual declarations, refresher assessment completion, and extend verified shopper certificates."
      />

      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "submitted", "needs_info", "approved", "rejected", "draft"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === s
                ? "bg-navy text-white shadow-xs"
                : "border border-line bg-white text-muted hover:text-navy"
            }`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted">
          No membership renewals match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r, idx) => {
            const name = r.member
              ? r.member.tradingName || `${r.member.firstName} ${r.member.lastName}`.trim() || r.member.user?.email
              : r.memberProfileId;
            return (
              <div
                key={r.id}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="glass-card stagger-enter flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-navy">{name}</p>
                    <Badge tone={statusTone(r.status.toUpperCase())}>{r.status.replace("_", " ").toUpperCase()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.submittedAt ? `Submitted ${r.submittedAt.slice(0, 10)}` : "Draft in progress"}
                    {r.member?.validUntil ? ` · Current expiry ${r.member.validUntil.slice(0, 10)}` : ""}
                  </p>
                  {r.decisionReason && <p className="mt-1 text-xs text-ink">{r.decisionReason}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => void openRenewal(r)}
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft"
                >
                  Review Renewal
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={submitDecision}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-navy">Review Annual Renewal</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-line p-1.5 text-muted hover:text-navy"
                aria-label="Close renewal modal"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {checklist.length > 0 && (
              <ul className="mt-4 space-y-2 rounded-xl border border-line bg-soft/40 p-3.5 text-xs">
                {checklist.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full ${
                        item.complete ? "bg-green-soft text-green-dark" : "bg-[#fff0ef] text-[#b42318]"
                      }`}
                    >
                      <Icon name={item.complete ? "check" : "close"} size={11} />
                    </span>
                    <span className={item.complete ? "text-navy" : "font-semibold text-[#b42318]"}>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Decision</label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as "approved" | "needs_info" | "rejected")}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                >
                  <option value="approved">Approve &amp; Extend Certificate (12 months)</option>
                  <option value="needs_info">Request Additional Information</option>
                  <option value="rejected">Reject Renewal</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Reason (min 10 characters)</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-navy">
                <input
                  type="checkbox"
                  checked={conflictOk}
                  onChange={(e) => setConflictOk(e.target.checked)}
                  className="accent-green"
                />
                I declare no conflict of interest in this renewal decision.
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || reason.trim().length < 10 || !conflictOk}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {busy ? "Saving..." : "Submit Decision"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
