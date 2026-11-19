import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ApplicationStatus, VerificationApplication } from "../types/admin";

type FilterValue = "QUEUE" | "ALL" | ApplicationStatus;

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Review queue", value: "QUEUE" },
  { label: "Pending", value: "PENDING" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Info required", value: "INFO_REQUIRED" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Incomplete", value: "INCOMPLETE" },
  { label: "All", value: "ALL" },
];

export default function Verifications() {
  const [apps, setApps] = useState<VerificationApplication[]>([]);
  const [filter, setFilter] = useState<FilterValue>("QUEUE");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminApi.listApplications().then(setApps);
  }, []);

  const visible = apps.filter((a) => {
    const matchesStatus =
      filter === "ALL"
        ? true
        : filter === "QUEUE"
          ? a.status === "PENDING" || a.status === "UNDER_REVIEW" || a.status === "INFO_REQUIRED"
          : a.status === filter;
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
        title="Shopper Verification"
        description="Review submissions, check evidence, verify tutorial & assessment completion, and record reasoned decisions. A shopper is listed publicly only after approval."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === f.value
                  ? "bg-navy text-white shadow-xs"
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

      <div className="space-y-3">
        {visible.map((app) => {
          const assessmentPassed = app.assessments.some((a) => a.passed);
          return (
            <Link
              key={app.id}
              to={`/admin/verifications/${app.id}`}
              className="glass-card group flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-navy group-hover:text-green-dark">{app.applicantName}</p>
                  <span className="text-xs text-muted">· {app.businessName}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {app.referenceCode} · {app.email} · {app.city}, {app.province}
                </p>
                <p className="mt-1 text-xs text-navy/70">{app.categories.join(" · ")}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge tone="muted">{app.documents.length} docs</Badge>
                <Badge tone={app.tutorialProgress.completed >= app.tutorialProgress.total ? "green" : "muted"}>
                  Tutorials: {app.tutorialProgress.completed}/{app.tutorialProgress.total}
                </Badge>
                <Badge tone={assessmentPassed ? "green" : "muted"}>
                  {assessmentPassed ? "Assessment passed" : "No pass yet"}
                </Badge>
                <Badge tone={app.completionPercent === 100 ? "green" : "amber"}>{app.completionPercent}%</Badge>
                <Badge tone={statusTone(app.status)}>{app.status.replace("_", " ")}</Badge>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-muted sm:w-36 sm:justify-end">
                <span>
                  {app.submittedAt
                    ? `Submitted ${app.submittedAt.slice(0, 10)}`
                    : app.verificationExpiresAt
                      ? `Expires ${app.verificationExpiresAt.slice(0, 10)}`
                      : `Joined ${app.createdAt.slice(0, 10)}`}
                </span>
                <Icon name="chevron" size={15} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-green" />
              </div>
            </Link>
          );
        })}

        {visible.length === 0 && (
          <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
            No applications match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
