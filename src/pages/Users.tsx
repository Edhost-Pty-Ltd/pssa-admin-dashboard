import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { MemberRecord, MemberStatus } from "../types/admin";

export default function Users() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");

  const load = () => adminApi.listMembers().then(setMembers);

  useEffect(() => {
    load();
  }, []);

  const visible = members.filter((m) => {
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    const q = search.toLowerCase();
    const matchesQ =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.businessName.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q);
    return matchesStatus && matchesQ;
  });

  const setStatus = async (id: string, status: MemberStatus) => {
    await adminApi.updateMemberStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Member Register"
        title="Verified Personal Shoppers"
        description="Manage active PSSA members, tier badges, category assignments, and standing."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(["ALL", "ACTIVE", "PROBATION", "SUSPENDED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                statusFilter === s ? "bg-navy text-white" : "border border-line bg-white text-muted hover:text-navy"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member or ID..."
            className="w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-sm focus:border-green focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-soft text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">Member</th>
                <th className="px-5 py-3.5">Tier</th>
                <th className="px-5 py-3.5">Categories</th>
                <th className="px-5 py-3.5">Runs / Rating</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((m) => (
                <tr key={m.id} className="hover:bg-soft/50">
                  <td className="px-5 py-4">
                    <p className="font-bold text-navy">{m.fullName}</p>
                    <p className="text-xs text-muted">
                      {m.memberNumber} · {m.businessName} · {m.city}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone(m.tier)}>{m.tier}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {m.categories.map((cat) => (
                        <span key={cat} className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-navy">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-navy">
                    {m.completedRuns} runs · ★ {m.rating.toFixed(1)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {m.status !== "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(m.id, "ACTIVE")}
                        className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-dark"
                      >
                        Reinstate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus(m.id, "SUSPENDED")}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#fff0ef]"
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
