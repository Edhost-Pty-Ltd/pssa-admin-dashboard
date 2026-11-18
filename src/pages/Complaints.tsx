import { useEffect, useState } from "react";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { CaseRecord, CaseStatus } from "../types/admin";

export default function Complaints() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CaseStatus>("INVESTIGATING");

  const load = () => adminApi.listCases().then(setCases);

  useEffect(() => {
    load();
  }, []);

  const openCase = (c: CaseRecord) => {
    setSelected(c);
    setNotes(c.resolutionNotes);
    setStatus(c.status);
  };

  const saveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await adminApi.updateCase(selected.id, status, notes);
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Consumer Protection"
        title="Cases & Safety Reports"
        description="Investigate policy breaches, scam alerts, and impersonation reports to keep customers and verified shoppers safe."
      />

      <div className="space-y-4">
        {cases.map((c) => (
          <div key={c.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-navy">{c.caseNumber}</h2>
                  <Badge tone={statusTone(c.severity)}>{c.severity} SEVERITY</Badge>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Category: <strong className="text-navy">{c.category}</strong> · Reported by {c.reporterName} ({c.reporterEmail}) · Opened {c.openedAt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCase(c)}
                className="rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Update Case
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form onSubmit={saveCase} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy">Update {selected.caseNumber}</h3>
            <p className="mt-1 text-xs text-muted">{selected.againstMember}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Case Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy">Resolution / Investigation Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white hover:bg-green-dark"
              >
                Save Update
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
