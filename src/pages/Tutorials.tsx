import { useEffect, useState } from "react";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";

type AssetKind = "tutorial_video" | "assignment_brief" | "assessor_guide";

type PracticalAsset = Awaited<ReturnType<typeof adminApi.listPracticalAssets>>["assets"][number];
type PracticalSubmissionSummary = Awaited<ReturnType<typeof adminApi.listPracticalSubmissions>>["submissions"][number];
type PracticalSubmissionDetail = Awaited<ReturnType<typeof adminApi.getPracticalSubmission>>;
type RubricArea = Awaited<ReturnType<typeof adminApi.listPracticalSubmissions>>["rubricAreas"][number];

const KIND_LABELS: Record<AssetKind, { title: string; subtitle: string; accept: string; badge: string }> = {
  tutorial_video: {
    title: "Tutorial Video (Applicant-facing)",
    subtitle: "MP4, WebM, or MOV. Shown before the practical assignment with replay & completion tracking.",
    accept: ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime",
    badge: "Applicant",
  },
  assignment_brief: {
    title: "Practical Assignment Brief (Applicant-facing)",
    subtitle: "PDF document displayed inline and downloadable on the applicant assessment page.",
    accept: ".pdf,application/pdf",
    badge: "Applicant",
  },
  assessor_guide: {
    title: "Assessor Guide (Internal Only)",
    subtitle: "PDF rubric and internal guidance. Never exposed to applicants or the public.",
    accept: ".pdf,application/pdf",
    badge: "Admin Only",
  },
};

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "navy" | "muted"> = {
  NOT_STARTED: "muted",
  IN_PROGRESS: "muted",
  SUBMITTED: "navy",
  UNDER_REVIEW: "amber",
  NEEDS_RESUBMISSION: "amber",
  PASSED: "green",
  NOT_PASSED: "red",
};

export default function Tutorials() {
  const [tab, setTab] = useState<"QUEUE" | "CONTENT">("QUEUE");
  const [assets, setAssets] = useState<PracticalAsset[]>([]);
  const [submissions, setSubmissions] = useState<PracticalSubmissionSummary[]>([]);
  const [rubricAreas, setRubricAreas] = useState<RubricArea[]>([]);
  const [threshold, setThreshold] = useState(70);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const [previewAsset, setPreviewAsset] = useState<PracticalAsset | null>(null);
  const [uploadKind, setUploadKind] = useState<AssetKind | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadActivate, setUploadActivate] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<PracticalSubmissionDetail | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [reviewerFeedback, setReviewerFeedback] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const notify = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = async () => {
    const [assetsRes, subsRes] = await Promise.all([
      adminApi.listPracticalAssets(),
      adminApi.listPracticalSubmissions({ status: statusFilter || undefined, q: searchQ || undefined }),
    ]);
    setAssets(assetsRes.assets);
    setThreshold(subsRes.practicalPassThreshold);
    setSubmissions(subsRes.submissions);
    setRubricAreas(subsRes.rubricAreas);
  };

  useEffect(() => {
    void loadAll().catch((err) => notify(errorMessage(err), true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openSubmission = async (id: string) => {
    try {
      const detail = await adminApi.getPracticalSubmission(id);
      setSelectedDetail(detail);
      const initialScores: Record<string, number> = {};
      for (const area of detail.rubricAreas) {
        initialScores[area.key] = detail.submission.rubricScores?.[area.key] ?? 0;
      }
      setRubricScores(initialScores);
      setReviewerFeedback(detail.submission.reviewerFeedback ?? "");
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const totalRubricScore = rubricAreas.reduce((sum, a) => sum + (rubricScores[a.key] ?? 0), 0);

  const handleReviewOutcome = async (outcome: "UNDER_REVIEW" | "PASSED" | "NEEDS_RESUBMISSION" | "NOT_PASSED") => {
    if (!selectedDetail) return;
    setSavingReview(true);
    try {
      await adminApi.reviewPracticalSubmission(selectedDetail.submission.id, {
        outcome,
        rubricScores,
        reviewerFeedback: reviewerFeedback.trim() || undefined,
      });
      notify(`Recorded outcome: ${outcome}`);
      await Promise.all([loadAll(), openSubmission(selectedDetail.submission.id)]);
    } catch (err) {
      notify(errorMessage(err), true);
    } finally {
      setSavingReview(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadKind || !uploadFile) return;
    setUploading(true);
    try {
      await adminApi.uploadPracticalAsset(uploadKind, uploadFile, uploadTitle, uploadActivate);
      notify(`Uploaded new version for ${KIND_LABELS[uploadKind].title}`);
      setUploadKind(null);
      setUploadTitle("");
      setUploadFile(null);
      await loadAll();
    } catch (err) {
      notify(errorMessage(err), true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Practical Assessment"
        title="Practical Assessment & Content Management"
        description="Review applicant shopping simulations against the internal rubric and manage versioned tutorial, assignment, and assessor guide assets."
        actions={
          <div className="flex gap-2 rounded-xl border border-line bg-white p-1">
            <button
              type="button"
              onClick={() => setTab("QUEUE")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === "QUEUE" ? "bg-navy text-white" : "text-muted hover:text-navy"
              }`}
            >
              Review Queue ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("CONTENT")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === "CONTENT" ? "bg-navy text-white" : "text-muted hover:text-navy"
              }`}
            >
              Content &amp; Versions ({assets.length})
            </button>
          </div>
        }
      />

      {toast && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
            toast.isError
              ? "border-[#f9c8c4] bg-[#fff0ef] text-[#b42318]"
              : "border-green/30 bg-green-soft text-green-dark"
          }`}
        >
          {toast.text}
        </div>
      )}

      {tab === "QUEUE" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadAll();
                }}
                placeholder="Search applicant name, email, or trading name..."
                className="w-72 rounded-xl border border-line px-3 py-1.5 text-xs focus:border-green focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-line px-3 py-1.5 text-xs focus:border-green focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="NEEDS_RESUBMISSION">Needs Resubmission</option>
                <option value="PASSED">Passed</option>
                <option value="NOT_PASSED">Not Passed</option>
                <option value="IN_PROGRESS">In Progress (Draft)</option>
              </select>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
              >
                Filter
              </button>
            </div>
            <div className="text-xs text-muted">
              Suggested pilot pass threshold: <strong className="text-navy">{threshold}/100</strong> (configurable in Settings)
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-soft/60 text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Versions</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      No practical assessment submissions match this filter.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-soft/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-navy">{s.applicant.name}</div>
                        <div className="text-[11px] text-muted">{s.applicant.email}</div>
                      </td>
                      <td className="px-4 py-3 text-navy">{s.serviceTrack ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        Tutorial v{s.tutorialVersion} · Brief v{s.assignmentVersion}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString("en-ZA") : "Draft"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[s.status] ?? "muted"}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy">
                        {s.totalScore !== null ? `${s.totalScore}/100` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void openSubmission(s.id)}
                          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Inspect &amp; Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "CONTENT" && (
        <div className="space-y-6">
          {(["tutorial_video", "assignment_brief", "assessor_guide"] as AssetKind[]).map((kind) => {
            const info = KIND_LABELS[kind];
            const list = assets.filter((a) => a.kind === kind);
            return (
              <section key={kind} className="rounded-2xl border border-line bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-navy">{info.title}</h2>
                      <Badge tone={kind === "assessor_guide" ? "red" : "green"}>{info.badge}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{info.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadKind(kind);
                      setUploadTitle("");
                      setUploadFile(null);
                      setUploadActivate(true);
                    }}
                    className="rounded-xl bg-green px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-dark"
                  >
                    Upload New Version
                  </button>
                </div>

                <div className="divide-y divide-line rounded-xl border border-line">
                  {list.map((asset) => (
                    <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-navy">v{asset.version}</span>
                          <span className="font-semibold text-navy">{asset.title}</span>
                          {asset.isActive && <Badge tone="green">Active</Badge>}
                          {asset.isDefault && <Badge tone="muted">Bundled Default</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          {asset.fileName} · {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB · Uploaded{" "}
                          {new Date(asset.createdAt).toLocaleDateString("en-ZA")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(asset)}
                          className="rounded-lg border border-line px-2.5 py-1 font-semibold text-navy hover:bg-soft"
                        >
                          Preview
                        </button>
                        <a
                          href={`${asset.fileUrl}?download=1`}
                          download={asset.fileName}
                          className="rounded-lg border border-line px-2.5 py-1 font-semibold text-navy hover:bg-soft"
                        >
                          Download
                        </a>
                        {asset.isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              void adminApi.deactivatePracticalAsset(asset.id).then(() => {
                                notify(`Deactivated v${asset.version}`);
                                return loadAll();
                              })
                            }
                            className="rounded-lg border border-[#f9c8c4] px-2.5 py-1 font-semibold text-[#b42318] hover:bg-[#fff0ef]"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void adminApi.activatePracticalAsset(asset.id).then(() => {
                                notify(`Activated v${asset.version}`);
                                return loadAll();
                              })
                            }
                            className="rounded-lg bg-green-soft px-2.5 py-1 font-semibold text-green-dark hover:bg-green/20"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Upload Asset Modal */}
      {uploadKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
          <form onSubmit={handleUpload} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-navy">Upload {KIND_LABELS[uploadKind].title}</h3>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">Version Title</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Q4 2026 Practical Assignment"
                className="w-full rounded-xl border border-line px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy">File *</label>
              <input
                type="file"
                required
                accept={KIND_LABELS[uploadKind].accept}
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-navy">
              <input
                type="checkbox"
                checked={uploadActivate}
                onChange={(e) => setUploadActivate(e.target.checked)}
              />
              Activate immediately for new applicants (in-progress applicants keep their version)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUploadKind(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Asset Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4">
          <div className="w-full max-w-4xl space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy">
                {previewAsset.title} (v{previewAsset.version})
              </h3>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-navy"
              >
                Close
              </button>
            </div>
            {previewAsset.mimeType.startsWith("video/") ? (
              <video src={previewAsset.fileUrl} controls className="w-full rounded-xl bg-black" style={{ maxHeight: 480 }} />
            ) : (
              <iframe title={previewAsset.title} src={previewAsset.fileUrl} className="h-[520px] w-full rounded-xl border border-line" />
            )}
          </div>
        </div>
      )}

      {/* Submission Review Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-navy">{selectedDetail.submission.applicant.name}</h3>
                  <Badge tone={STATUS_TONE[selectedDetail.submission.status] ?? "muted"}>
                    {selectedDetail.submission.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {selectedDetail.submission.applicant.email} · Track: {selectedDetail.submission.serviceTrack ?? "—"} · Tutorial v
                  {selectedDetail.submission.tutorialVersion} · Brief v{selectedDetail.submission.assignmentVersion}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="rounded-xl border border-line px-3.5 py-1.5 text-xs font-semibold text-navy"
              >
                Close
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Applicant Answers */}
              <div className="space-y-4 text-xs">
                <h4 className="text-sm font-bold text-navy">Submitted Responses</h4>
                {selectedDetail.submission.answers ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-line p-3">
                      <div className="font-semibold text-navy">Brief Summary</div>
                      <p className="mt-1 whitespace-pre-wrap text-muted">
                        {selectedDetail.submission.answers.briefSummary || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line p-3 space-y-2">
                      <div className="font-semibold text-navy">Researched Options</div>
                      {(selectedDetail.submission.answers.options ?? []).map((opt: any, i: number) => (
                        <div key={i} className="rounded-lg bg-soft/60 p-2">
                          <div className="font-semibold text-navy">
                            {i + 1}. {opt.name} — {opt.price} ({opt.retailer})
                          </div>
                          {opt.url && (
                            <a href={opt.url} target="_blank" rel="noreferrer" className="text-green-dark underline break-all">
                              {opt.url}
                            </a>
                          )}
                          <p className="mt-1 text-muted">{opt.suitability}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-line p-3">
                      <div className="font-semibold text-navy">Budget Calculation</div>
                      <p className="mt-1 text-muted">
                        Total: {selectedDetail.submission.answers.budget?.estimatedTotal} · Extra:{" "}
                        {selectedDetail.submission.answers.budget?.additionalCosts} · Remaining/Diff:{" "}
                        {selectedDetail.submission.answers.budget?.remainingOrOver} · Checked:{" "}
                        {selectedDetail.submission.answers.budget?.priceCheckedDate}
                      </p>
                      <p className="mt-1 text-muted">{selectedDetail.submission.answers.budget?.assumptions}</p>
                    </div>
                    <div className="rounded-xl border border-line p-3">
                      <div className="font-semibold text-navy">Recommendation &amp; Backup</div>
                      <p className="mt-1 whitespace-pre-wrap text-muted">
                        {selectedDetail.submission.answers.recommendation?.preferredPlan}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-muted">
                        <strong>Backup:</strong> {selectedDetail.submission.answers.recommendation?.backupOption}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line p-3">
                      <div className="font-semibold text-navy">Sample Customer Approval Message</div>
                      <p className="mt-1 whitespace-pre-wrap text-muted">
                        {selectedDetail.submission.answers.customerMessage}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line p-3 space-y-1">
                      <div className="font-semibold text-navy">Responsible Practice</div>
                      <p className="text-muted">
                        <strong>Price changes:</strong> {selectedDetail.submission.answers.responsibility?.priceChanges}
                      </p>
                      <p className="text-muted">
                        <strong>Disclosure:</strong> {selectedDetail.submission.answers.responsibility?.commissionDisclosure}
                      </p>
                      <p className="text-muted">
                        <strong>Privacy:</strong> {selectedDetail.submission.answers.responsibility?.privacyProtection}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted">No structured answers saved yet.</p>
                )}

                <div className="rounded-xl border border-line p-3">
                  <div className="font-semibold text-navy">Optional Supporting Evidence</div>
                  {selectedDetail.submission.evidence ? (
                    <a
                      href={selectedDetail.submission.evidence.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-semibold text-green-dark underline"
                    >
                      View/Download {selectedDetail.submission.evidence.fileName}
                    </a>
                  ) : (
                    <p className="mt-1 text-muted">None attached (optional).</p>
                  )}
                </div>
              </div>

              {/* Assessor Rubric & Outcome */}
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-navy">Assessor Rubric Scoring</h4>
                  <span className="font-bold text-navy">
                    Total: {totalRubricScore}/100 (Suggested threshold: {selectedDetail.practicalPassThreshold}/100)
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selectedDetail.rubricAreas.map((area) => (
                    <div key={area.key} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-navy">
                          {area.label} (max {area.maxPoints})
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={area.maxPoints}
                          value={rubricScores[area.key] ?? 0}
                          onChange={(e) =>
                            setRubricScores({
                              ...rubricScores,
                              [area.key]: Math.max(0, Math.min(area.maxPoints, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-20 rounded-lg border border-line px-2 py-1 text-right font-semibold text-navy"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">{area.guidance}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-navy">
                    Reviewer Feedback (required for Resubmission / Not Passed)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewerFeedback}
                    onChange={(e) => setReviewerFeedback(e.target.value)}
                    placeholder="Record specific strengths, gaps, or required corrections..."
                    className="w-full rounded-xl border border-line p-2.5 text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void handleReviewOutcome("UNDER_REVIEW")}
                    className="rounded-xl border border-line px-3.5 py-2 font-semibold text-navy hover:bg-soft"
                  >
                    Mark Under Review
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void handleReviewOutcome("PASSED")}
                    className="rounded-xl bg-green px-3.5 py-2 font-semibold text-white hover:bg-green-dark"
                  >
                    Pass Assessment
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void handleReviewOutcome("NEEDS_RESUBMISSION")}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 font-semibold text-amber-900"
                  >
                    Request Resubmission
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void handleReviewOutcome("NOT_PASSED")}
                    className="rounded-xl border border-[#f9c8c4] bg-[#fff0ef] px-3.5 py-2 font-semibold text-[#b42318]"
                  >
                    Not Passed
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  Note: Passing the practical assessment records only the assessment outcome. Membership and verification approval remain separate decisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
