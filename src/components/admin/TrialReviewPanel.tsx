import { useState } from "react";
import { Icon } from "../Icon";
import { Badge, statusTone } from "../ui/Badge";
import { adminApi } from "../../lib/adminApi";
import type { TrialStatus, VerificationApplication } from "../../types/admin";

const TRIAL_LABEL: Record<TrialStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted for review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "New video requested",
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function TrialReviewPanel({
  profile,
  rubric,
  onUpdated,
}: {
  profile: VerificationApplication;
  rubric: { id: string; label: string }[];
  onUpdated: (p: VerificationApplication) => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "CHANGES_REQUESTED" | null>(null);

  const trial = profile.trial;
  const latest = trial.videos[0];
  const reviewable = latest?.status === "SUBMITTED" && (profile.status === "PENDING" || profile.status === "UNDER_REVIEW");
  const allChecked = rubric.length > 0 && rubric.every((r) => checks[r.id]);

  const review = async (decision: "APPROVED" | "CHANGES_REQUESTED") => {
    setBusy(decision);
    try {
      const updated = await adminApi.reviewTrial(profile.id, decision, checks, note.trim() || undefined);
      onUpdated(updated);
      setChecks({});
      setNote("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand/70 text-navy">
            <Icon name="play" size={16} />
          </span>
          <h2 className="text-lg font-bold text-navy">Shopper Trial &amp; Video Review</h2>
        </div>
        <Badge tone={statusTone(trial.status)}>{TRIAL_LABEL[trial.status]}</Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-line/70 bg-soft/60 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Lessons</dt>
          <dd className="mt-1 font-bold text-navy">
            {trial.lessonsCompleted}/{trial.lessonsTotal} completed
          </dd>
        </div>
        <div className="rounded-xl border border-line/70 bg-soft/60 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Shopper Conditions</dt>
          <dd className="mt-1 font-bold text-navy">
            {trial.conditionsAcceptedAt ? `Accepted ${trial.conditionsAcceptedAt.slice(0, 10)}` : "Not accepted"}
          </dd>
        </div>
        <div className="rounded-xl border border-line/70 bg-soft/60 p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Trial Recording</dt>
          <dd className="mt-1 font-bold text-navy">
            {latest ? `${clock(latest.durationSeconds)} · ${formatMb(latest.sizeBytes)}` : "Not submitted"}
          </dd>
        </div>
      </dl>

      {!latest && (
        <p className="mt-4 rounded-xl border border-line bg-soft/50 p-4 text-xs leading-relaxed text-muted">
          No trial video yet. The application cannot be approved until the shopper submits their trial recording and it is approved here.
        </p>
      )}

      {latest && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border-l-4 border-l-sand-dark bg-sand/35 px-4 py-3 text-xs">
            <p className="font-bold uppercase tracking-wider text-navy/70">Assigned Scenario</p>
            <p className="mt-1 text-sm text-navy">{latest.scenarioPrompt || trial.scenarioPrompt}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line bg-navy px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green/20 text-green">
                <Icon name="play" size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold">Trial Recording ({latest.id})</p>
                <p className="text-xs text-white/65">
                  Submitted {latest.createdAt.slice(0, 10)} · {clock(latest.durationSeconds)} · {formatMb(latest.sizeBytes)}
                </p>
              </div>
            </div>
            <Badge tone={statusTone(latest.status)}>{latest.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-[11px] text-muted">Video reviews are recorded in the PSSA compliance audit log.</p>
        </div>
      )}

      {latest && latest.status !== "SUBMITTED" && latest.reviewedAt && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
            latest.status === "APPROVED"
              ? "border-green/30 bg-green-soft/60 text-green-dark"
              : "border-[#f2d492] bg-[#fff5df] text-[#8a5a00]"
          }`}
        >
          <strong>{latest.status === "APPROVED" ? "Trial approved" : "New video requested"}</strong>
          {latest.reviewer ? ` · ${latest.reviewer}` : ""} · {latest.reviewedAt.slice(0, 10)}
          {latest.reviewerNote ? ` — ${latest.reviewerNote}` : ""}
        </div>
      )}

      {reviewable && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <p className="text-sm font-bold text-navy">Review Criteria</p>
          <div className="space-y-2.5">
            {rubric.map((r) => (
              <label key={r.id} className="flex items-start gap-2.5 text-xs text-navy">
                <input
                  type="checkbox"
                  checked={Boolean(checks[r.id])}
                  onChange={(e) => setChecks((c) => ({ ...c, [r.id]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-green"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">Note to the shopper</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required when requesting a new video (at least 10 characters)..."
              maxLength={2000}
              className="w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={!allChecked || busy !== null}
              onClick={() => review("APPROVED")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name="check" size={14} />
              {busy === "APPROVED" ? "Approving..." : "Approve trial"}
            </button>
            <button
              type="button"
              disabled={note.trim().length < 10 || busy !== null}
              onClick={() => review("CHANGES_REQUESTED")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-soft disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name="audit" size={14} />
              {busy === "CHANGES_REQUESTED" ? "Sending..." : "Request a new video"}
            </button>
          </div>
          {!allChecked && (
            <p className="text-[11px] text-muted">
              Check every criterion above to approve. Requesting a new video returns the application to the shopper.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
