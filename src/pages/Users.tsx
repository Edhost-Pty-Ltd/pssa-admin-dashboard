import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { MemberRecord, MemberStatus } from "../types/admin";

export default function Users() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");

  const load = async () => {
    const m = await adminApi.listMembers();
    setMembers(m);
  };

  useEffect(() => {
    void adminApi.listMembers().then(setMembers);
  }, []);

  const visibleShoppers = members.filter((m) => {
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    const q = search.toLowerCase();
    const matchesQ =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.businessName.toLowerCase().includes(q) ||
      m.memberNumber.toLowerCase().includes(q);
    return matchesStatus && matchesQ;
  });

  const setShopperStatus = async (id: string, status: MemberStatus) => {
    await adminApi.updateMemberStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Member Register"
        title="Verified Shoppers"
        description="Manage verified personal shopper standing, tiers, and public directory status."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(["ALL", "ACTIVE", "PROBATION", "SUSPENDED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === s ? "bg-green text-white" : "border border-line bg-white text-muted hover:text-navy"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shopper or ID..."
            className="w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-sm focus:border-green focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {visibleShoppers.map((m) => (
          <div key={m.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/admin/users/${m.id}`} className="min-w-0 group">
                <p className="truncate font-bold text-navy group-hover:text-green-dark">{m.fullName}</p>
                <p className="text-xs text-muted">
                  {m.memberNumber} · {m.businessName} · {m.city}
                </p>
              </Link>
              <Badge tone={statusTone(m.status)}>{m.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone={statusTone(m.tier)}>{m.tier}</Badge>
              {m.categories.map((cat) => (
                <span key={cat} className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-navy">
                  {cat}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs font-semibold text-navy">
                {m.verifiedChecks} checks · ★ {m.rating.toFixed(1)}
              </span>
              {m.status !== "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => setShopperStatus(m.id, "ACTIVE")}
                  className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-dark"
                >
                  Reinstate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShopperStatus(m.id, "SUSPENDED")}
                  className="rounded-lg border border-[#f9c8c4] bg-[#fff0ef] px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#ffe4e2]"
                >
                  Suspend
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-soft text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Shopper</th>
                  <th className="px-5 py-3.5">Tier</th>
                  <th className="px-5 py-3.5">Specialties</th>
                  <th className="px-5 py-3.5">Checks / Rating</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleShoppers.map((m) => (
                  <tr key={m.id} className="hover:bg-soft/50">
                    <td className="px-5 py-4">
                      <Link to={`/admin/users/${m.id}`} className="group block">
                        <p className="font-bold text-navy group-hover:text-green-dark">{m.fullName}</p>
                        <p className="text-xs text-muted">
                          {m.memberNumber} · {m.businessName} · {m.city}
                        </p>
                      </Link>
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
                      {m.verifiedChecks} verifications · ★ {m.rating.toFixed(1)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {m.status !== "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => setShopperStatus(m.id, "ACTIVE")}
                          className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-dark"
                        >
                          Reinstate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShopperStatus(m.id, "SUSPENDED")}
                          className="rounded-lg border border-[#f9c8c4] bg-[#fff0ef] px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#ffe4e2]"
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
