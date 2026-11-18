import { useEffect, useState } from "react";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { AuditEntry } from "../types/admin";

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    adminApi.listAudit().then(setEntries);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governance"
        title="Audit Log"
        description="Chronological record of admin approvals, category changes, and compliance decisions."
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
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
    </div>
  );
}
