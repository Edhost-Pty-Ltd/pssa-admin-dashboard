import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { CustomerMemberRecord, CustomerStatus, MemberRecord, MemberStatus } from "../types/admin";

export default function Users() {
  const [tab, setTab] = useState<"SHOPPERS" | "CUSTOMERS">("SHOPPERS");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerMemberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");

  const load = async () => {
    const [m, c] = await Promise.all([adminApi.listMembers(), adminApi.listCustomers()]);
    setMembers(m);
    setCustomers(c);
  };

  useEffect(() => {
    load();
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

  const visibleCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q)
    );
  });

  const setShopperStatus = async (id: string, status: MemberStatus) => {
    await adminApi.updateMemberStatus(id, status);
    await load();
  };

  const setCustomerStatus = async (id: string, status: CustomerStatus) => {
    await adminApi.updateCustomerStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Member Register"
        title="Verified Shoppers & Customer Members"
        description="Manage verified personal shopper standing and customer members registered to view full shopper profiles."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-line bg-white/80 p-1">
            <button
              type="button"
              onClick={() => setTab("SHOPPERS")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === "SHOPPERS" ? "bg-navy text-white" : "text-muted hover:text-navy"
              }`}
            >
              Verified Shoppers ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("CUSTOMERS")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === "CUSTOMERS" ? "bg-navy text-white" : "text-muted hover:text-navy"
              }`}
            >
              Customer Members ({customers.length})
            </button>
          </div>

          {tab === "SHOPPERS" && (
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
          )}
        </div>

        <div className="relative w-full max-w-xs">
          <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "SHOPPERS" ? "Search shopper or ID..." : "Search customer or code..."}
            className="w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-sm focus:border-green focus:outline-none"
          />
        </div>
      </div>

      {tab === "SHOPPERS" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-soft text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Customer Member</th>
                  <th className="px-5 py-3.5">City</th>
                  <th className="px-5 py-3.5">Safety Policy</th>
                  <th className="px-5 py-3.5">Shopper Lookups</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-soft/50">
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy">{c.fullName}</p>
                      <p className="text-xs text-muted">
                        {c.customerCode} · {c.email}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-navy">{c.city}</td>
                    <td className="px-5 py-4">
                      <Badge tone={c.policyAccepted ? "green" : "amber"}>
                        {c.policyAccepted ? "Policy Accepted" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-navy">{c.shopperLookups} lookups</td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {c.status !== "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => setCustomerStatus(c.id, "ACTIVE")}
                          className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-dark"
                        >
                          Restore Access
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomerStatus(c.id, "SUSPENDED")}
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
      )}
    </div>
  );
}
