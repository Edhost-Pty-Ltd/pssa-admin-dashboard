import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ApplicationStatus, VerificationApplication } from "../types/admin";

const FILTERS: { label: string; value: "ALL" | ApplicationStatus }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Info Requested", value: "INFO_REQUESTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function Verifications() {
  const [apps, setApps] = useState<VerificationApplication[]>([]);
  const [filter, setFilter] = useState<"ALL" | ApplicationStatus>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminApi.listApplications().then(setApps);
  }, []);

  const visible = apps.filter((a) => {
    const matchesStatus = filter === "ALL" || a.status === filter;
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      a.applicantName.toLowerCase().includes(q) ||
      a.businessName.toLowerCase().includes(q) ||
      a.referenceCode.toLowerCase().includes(q) ||
      a.primaryCategory.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Membership Vetting"
        title="Shopper Verifications"
        description="Review ID checks, proof of residence, and category experience before issuing a PSSA verified badge."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.value
                  ? "bg-navy text-white"
                  : "border border-line bg-white text-muted hover:text-navy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicant or ref..."
            className="w-full rounded-xl border border-line bg-white py-2 pr-3 pl-9 text-sm focus:border-green focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-soft text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">Applicant</th>
                <th className="px-5 py-3.5">Primary Category</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Docs Verified</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((app) => {
                const verifiedCount = app.documents.filter((d) => d.verified).length;
                return (
                  <tr key={app.id} className="hover:bg-soft/50">
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy">{app.applicantName}</p>
                      <p className="text-xs text-muted">
                        {app.businessName} · {app.referenceCode}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-navy">{app.primaryCategory}</td>
                    <td className="px-5 py-4 text-xs text-muted">
                      {app.city}, {app.province}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-navy">
                      {verifiedCount} / {app.documents.length}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone(app.status)}>{app.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/verifications/${app.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                      >
                        Review
                        <Icon name="chevron" size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                    No applications match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
