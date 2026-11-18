import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { Badge, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type {
  CaseRecord,
  CustomerMemberRecord,
  ListingRecord,
  MemberRecord,
  VerificationApplication,
} from "../types/admin";

interface OverviewData {
  applications: VerificationApplication[];
  members: MemberRecord[];
  customers: CustomerMemberRecord[];
  cases: CaseRecord[];
  listings: ListingRecord[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function gateSummary(app: VerificationApplication): string {
  const docsReady =
    app.documents.some((d) => d.type === "id_document" && d.status === "ACCEPTED") &&
    app.documents.some((d) => (d.type === "proof_of_residence" || d.type === "business_registration") && d.status === "ACCEPTED") &&
    app.documents.some((d) => d.type === "bank_evidence" && d.status === "ACCEPTED");
  const channelReady = app.channels.some((c) => c.confirmed);
  const assessmentPassed = app.assessments.some((a) => a.passed);
  const trialApproved = app.trial.status === "APPROVED";
  const passedCount =
    (docsReady && channelReady ? 1 : 0) +
    (app.conductAcceptedAt && app.emailVerifiedAt && app.phoneVerifiedAt ? 1 : 0) +
    (assessmentPassed ? 1 : 0) +
    (trialApproved ? 1 : 0);
  return `${passedCount}/4 gates`;
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    adminApi.getOverview().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-3xl bg-navy/10" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      </div>
    );
  }

  const pendingApps = data.applications.filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW");
  const activeMembers = data.members.filter((m) => m.status === "ACTIVE");
  const activeCustomers = data.customers.filter((c) => c.status === "ACTIVE");
  const openCases = data.cases.filter((c) => c.status !== "RESOLVED");

  const stats: {
    label: string;
    value: number;
    sub: string;
    to: string;
    icon: IconName;
    iconBg: string;
    barColor: string;
    barPct: number;
    accent: string;
  }[] = [
    {
      label: "Pending Verifications",
      value: pendingApps.length,
      sub: `${data.applications.length} total shopper applications`,
      to: "/admin/verifications",
      icon: "shield",
      iconBg: "bg-green-soft text-green-dark",
      barColor: "bg-green",
      barPct: Math.min(100, Math.round((pendingApps.length / Math.max(1, data.applications.length)) * 100)),
      accent: "text-navy",
    },
    {
      label: "Verified Shoppers",
      value: activeMembers.length,
      sub: `${data.listings.length} verified specialty profiles`,
      to: "/admin/users",
      icon: "badge",
      iconBg: "bg-sand/70 text-navy",
      barColor: "bg-navy",
      barPct: Math.min(100, Math.round((activeMembers.length / Math.max(1, data.members.length)) * 100)),
      accent: "text-green-dark",
    },
    {
      label: "Customer Members",
      value: activeCustomers.length,
      sub: `${data.customers.reduce((s, c) => s + c.shopperLookups, 0)} verified shopper lookups`,
      to: "/admin/users",
      icon: "people",
      iconBg: "bg-[#eaf3fb] text-navy-2",
      barColor: "bg-navy-3",
      barPct: Math.min(100, Math.round((activeCustomers.length / Math.max(1, data.customers.length)) * 100)),
      accent: "text-navy",
    },
    {
      label: "Safety & Policy Cases",
      value: openCases.length,
      sub: `${data.cases.length} total safety cases`,
      to: "/admin/complaints",
      icon: "flag",
      iconBg: openCases.length > 0 ? "bg-[#fff0ef] text-[#b42318]" : "bg-green-soft text-green-dark",
      barColor: openCases.length > 0 ? "bg-[#b42318]" : "bg-green",
      barPct: Math.min(100, Math.round((openCases.length / Math.max(1, data.cases.length)) * 100)),
      accent: openCases.length > 0 ? "text-[#b42318]" : "text-green-dark",
    },
  ];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-navy px-6 py-7 text-white shadow-[0_24px_60px_-24px_rgba(11,32,55,0.55)] sm:px-9 sm:py-8">
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-35 blur-3xl"
          style={{ background: "radial-gradient(circle, #18a269 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #efe6d4 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sand">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              {getGreeting()} · PSSA Trust &amp; Safety Desk
            </div>
            <h1 className="mt-3.5 font-display text-2xl font-semibold tracking-tight text-white sm:text-[34px] sm:leading-[1.12]">
              Shopper Verification &amp; <span className="text-sand">Scam Prevention</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              Verify personal shopper identities, enforce 4-gate accreditation, and ensure customer members safely view authenticated provider profiles.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <div className="rounded-xl border border-white/12 bg-white/8 px-3.5 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Verified Shoppers</p>
                <p className="font-display text-base font-semibold text-sand">{activeMembers.length} active providers</p>
              </div>
              <div className="rounded-xl border border-white/12 bg-white/8 px-3.5 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Vetting Queue</p>
                <p className="font-display text-base font-semibold text-white">{pendingApps.length} awaiting review</p>
              </div>
              <div className="rounded-xl border border-white/12 bg-white/8 px-3.5 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Customer Members</p>
                <p className="font-display text-base font-semibold text-[#8bdbb8]">
                  {activeCustomers.length} policy-verified
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/16"
            >
              <Icon name="people" size={16} className="text-sand" />
              Member Directory
            </Link>
            <Link
              to="/admin/verifications"
              className="inline-flex items-center gap-2 rounded-xl bg-green px-4.5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(24,162,105,0.7)] transition hover:-translate-y-0.5 hover:bg-green-dark"
            >
              <Icon name="shield" size={16} />
              Review Queue
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="group relative overflow-hidden rounded-2xl border border-line bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-green/45 hover:shadow-[0_18px_36px_-18px_rgba(11,32,55,0.2)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{s.label}</p>
                <p className={`mt-2 font-display text-3xl font-bold ${s.accent}`}>{s.value}</p>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg} transition-transform duration-200 group-hover:scale-105`}
              >
                <Icon name={s.icon} size={18} />
              </span>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-soft">
              <div className={`h-full rounded-full ${s.barColor} transition-all duration-500`} style={{ width: `${s.barPct}%` }} />
            </div>

            <p className="mt-2.5 flex items-center justify-between text-xs text-muted">
              <span>{s.sub}</span>
              <Icon name="arrow" size={14} className="text-green transition-transform duration-200 group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-green-dark">4-Gate Accreditation</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-navy">Shopper Verification Queue</h2>
            </div>
            <Link
              to="/admin/verifications"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft/70 px-3 py-1 text-xs font-semibold text-navy transition hover:border-green/40 hover:bg-green-soft/60 hover:text-green-dark"
            >
              View all
              <Icon name="arrow" size={13} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.applications.slice(0, 4).map((app) => (
              <Link
                key={app.id}
                to={`/admin/verifications/${app.id}`}
                className="group flex flex-col justify-between gap-3 rounded-xl border border-line/70 bg-soft/45 p-3.5 transition-all hover:border-green/35 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sand to-sand-dark/60 font-display text-xs font-bold text-navy ring-2 ring-white">
                    {initials(app.applicantName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-navy group-hover:text-green-dark">{app.applicantName}</span>
                      <span className="truncate text-xs text-muted">· {app.businessName}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {app.referenceCode} · {app.primaryCategory} · {gateSummary(app)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Badge tone={statusTone(app.status)}>{app.status.replace("_", " ")}</Badge>
                  <Icon
                    name="arrow"
                    size={14}
                    className="text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:text-green group-hover:opacity-100"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-green-dark">Provider Trust</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-navy">Verified Shopper Standing</h2>
            </div>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft/70 px-3 py-1 text-xs font-semibold text-navy transition hover:border-green/40 hover:bg-green-soft/60 hover:text-green-dark"
            >
              Directory
              <Icon name="arrow" size={13} />
            </Link>
          </div>

          <div className="space-y-3">
            {data.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-soft/45 px-3.5 py-3 transition hover:border-green/35 hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-navy">{m.fullName}</p>
                    <Badge tone={statusTone(m.tier)}>{m.tier}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {m.memberNumber} · {m.city} · {m.verifiedChecks} checks
                  </p>
                </div>
                <Badge tone={statusTone(m.status)}>{m.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-green-dark">Customer Access &amp; Safety</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-navy">Customer Members</h2>
            </div>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft/70 px-3 py-1 text-xs font-semibold text-navy transition hover:border-green/40 hover:bg-green-soft/60 hover:text-green-dark"
            >
              Manage members
              <Icon name="arrow" size={13} />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.customers.map((c) => (
              <div
                key={c.id}
                className="flex flex-col justify-between rounded-xl border border-line/80 bg-soft/45 p-4 transition hover:border-green/35 hover:bg-white hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold tracking-wide text-navy">{c.customerCode}</span>
                    <Badge tone={c.policyAccepted ? "green" : "amber"}>
                      {c.policyAccepted ? "Policy OK" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-2 font-semibold text-navy">{c.fullName}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.email}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3">
                  <span className="text-[11px] font-medium text-muted">{c.city}</span>
                  <span className="text-xs font-semibold text-navy">{c.shopperLookups} shopper lookups</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:col-span-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-green-dark">Scam Prevention</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-navy">Safety &amp; Policy Cases</h2>
            </div>
            <Link
              to="/admin/complaints"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft/70 px-3 py-1 text-xs font-semibold text-navy transition hover:border-green/40 hover:bg-green-soft/60 hover:text-green-dark"
            >
              Manage cases
              <Icon name="arrow" size={13} />
            </Link>
          </div>

          <div className="space-y-3">
            {data.cases.map((c) => {
              const stripe =
                c.severity === "HIGH"
                  ? "border-l-[#b42318]"
                  : c.severity === "MEDIUM"
                    ? "border-l-[#d97706]"
                    : "border-l-green";
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border border-line/80 border-l-4 ${stripe} bg-soft/45 p-3.5 transition hover:bg-white hover:shadow-sm`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-navy">{c.caseNumber}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={statusTone(c.severity)}>{c.severity}</Badge>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink">{c.summary}</p>
                  <p className="mt-2 text-[11px] text-muted">
                    Reported by <span className="font-semibold text-navy">{c.reporterName}</span> · Against: {c.againstMember}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
