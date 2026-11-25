import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { MemberDetailRecord } from "../types/admin";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void adminApi
      .getMemberDetail(id)
      .then((m) => {
        if (active) setMember(m);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="h-56 animate-pulse rounded-3xl bg-white/60" />;
  }

  if (!member) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-muted">Member profile not found.</p>
        <Link to="/admin/users" className="mt-3 inline-block text-sm font-semibold text-green-dark underline">
          Back to Verified Shoppers
        </Link>
      </div>
    );
  }

  const fullName = `${member.firstName} ${member.lastName}`.trim() || member.email;
  const isVerifiedActive = member.memberStatus === "active";
  const verificationLink = member.application
    ? `/admin/verifications/${member.application.id}`
    : `/admin/verifications/member:${member.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-navy"
        >
          <Icon name="chevron" size={14} className="rotate-180" />
          Back to Verified Shoppers
        </Link>
        <Badge tone={statusTone(isVerifiedActive ? "ACTIVE" : member.memberStatus === "suspended" ? "SUSPENDED" : "PROBATION")}>
          {isVerifiedActive ? "ACTIVE VERIFIED" : member.memberStatus ? member.memberStatus.toUpperCase() : "VERIFICATION IN PROGRESS"}
        </Badge>
      </div>

      <PageHeader
        kicker="Member Profile"
        title={member.tradingName || fullName}
        description={`${fullName} · ${member.email}${member.city ? ` · ${member.city}` : ""}`}
        actions={
          <Link
            to={verificationLink}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold text-navy hover:bg-soft"
          >
            <Icon name="shield" size={15} />
            {member.application ? `View Application (${member.application.number})` : "View Verification Progress"}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="glass-card rounded-2xl p-6 lg:col-span-7 space-y-5">
          <h2 className="text-lg font-bold text-navy">Shopper Details</h2>

          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">Full Name</p>
              <p className="mt-1 font-medium text-navy">{fullName}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">Trading Name</p>
              <p className="mt-1 font-medium text-navy">{member.tradingName || "—"}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">Email</p>
              <p className="mt-1 font-medium text-navy">{member.email}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">Phone</p>
              <p className="mt-1 font-medium text-navy">{member.phone || "—"}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">City / Address</p>
              <p className="mt-1 font-medium text-navy">
                {[member.physicalAddress, member.city].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">Scope / Specialty</p>
              <p className="mt-1 font-medium text-navy">{member.scope || "Personal Shopping"}</p>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Declared Trading Channels</h3>
            {member.channels.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No trading channels declared yet.</p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {member.channels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between rounded-xl border border-line bg-soft/40 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-bold text-navy">{ch.kind}</p>
                      <p className="text-xs text-muted">{ch.value}</p>
                    </div>
                    <Badge tone={ch.status === "verified" || ch.status === "confirmed" ? "green" : "amber"}>
                      {ch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6 lg:col-span-5 space-y-5">
          {isVerifiedActive && member.certificate ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-navy">Active Certificate</h2>
                <Badge tone={member.certificate.status === "active" ? "green" : "amber"}>
                  {member.certificate.status}
                </Badge>
              </div>
              <div className="rounded-2xl border border-green/25 bg-green-soft/50 p-4 space-y-2 text-xs">
                <p className="font-bold text-green-dark">Certificate #{member.certificate.number}</p>
                <p className="text-navy">
                  Valid: <strong>{member.certificate.validFrom.slice(0, 10)}</strong> to{" "}
                  <strong>{member.certificate.validUntil.slice(0, 10)}</strong>
                </p>
                {member.certificate.scope && (
                  <p className="text-muted">Scope: {member.certificate.scope}</p>
                )}
                {member.certificate.qrTargetUrl && (
                  <a
                    href={member.certificate.qrTargetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-green-dark underline"
                  >
                    Open Public Verification Link
                    <Icon name="arrow" size={12} />
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-navy">Verification Status</h2>
              <div className="rounded-2xl border border-[#f2d492] bg-[#fff5df]/60 p-4 text-xs text-[#8a5a00]">
                <p className="font-bold">Verification In Progress</p>
                <p className="mt-1 leading-relaxed">
                  {member.application
                    ? `Application ${member.application.number} is currently "${member.application.status.replace("_", " ")}".`
                    : "This member created an account and is still completing their verification steps before submitting an application."}
                </p>
                <Link
                  to={verificationLink}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-2"
                >
                  Open Verification Review
                  <Icon name="arrow" size={12} />
                </Link>
              </div>
            </>
          )}

          <div className="border-t border-line pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Standing History</h3>
            {member.history.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No status changes recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l border-line pl-4">
                {member.history.map((h) => (
                  <li key={h.id} className="relative text-xs">
                    <span className="absolute top-1 -left-[1.3rem] h-2 w-2 rounded-full bg-green" />
                    <p className="font-bold text-navy">
                      {h.from ? `${h.from} → ` : ""}
                      {h.to}
                    </p>
                    <p className="mt-0.5 text-ink">{h.reason}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {h.actor ? `${h.actor.firstName} ${h.actor.lastName}`.trim() || h.actor.email : "System"} ·{" "}
                      {h.at.slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
