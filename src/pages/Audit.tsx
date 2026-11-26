import { useEffect, useState } from "react";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";
import type { AuditEntry } from "../types/admin";

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi
      .listAudit()
      .then(setEntries)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    adminApi
      .listAudit()
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governance"
        title="Audit Log"
        description="Chronological record of admin approvals, member status updates, tutorial uploads, and compliance decisions."
      />

      {loading ? (
        <div className="h-44 animate-pulse rounded-2xl bg-white/60" />
      ) : error ? (
        <div className="glass-card rounded-2xl border border-[#f9c8c4] bg-[#fff0ef] p-6 text-sm text-[#b42318]">
          <p className="font-semibold">Unable to load audit log</p>
          <p className="mt-1 text-xs">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-2"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted">
          No audit events recorded yet.
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="divide-y divide-line">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">{e.category}</Badge>
                    <span className="text-sm font-bold text-navy">{e.action}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Target: <strong className="text-ink">{e.target}</strong> · By {e.actor}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted">{e.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
