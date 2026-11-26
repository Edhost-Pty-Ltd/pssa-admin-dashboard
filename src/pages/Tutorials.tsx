import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";
import type { ExamDocumentRecord, ExamOption, ExamQuestionRecord, TutorialRecord } from "../types/admin";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EMPTY_OPTIONS: ExamOption[] = [
  { id: "a", label: "" },
  { id: "b", label: "" },
  { id: "c", label: "" },
  { id: "d", label: "" },
];

export default function Tutorials() {
  const [tab, setTab] = useState<"CONTENT" | "ASSESSMENT">("CONTENT");
  const [tutorials, setTutorials] = useState<TutorialRecord[]>([]);
  const [examDocs, setExamDocs] = useState<ExamDocumentRecord[]>([]);
  const [questions, setQuestions] = useState<ExamQuestionRecord[]>([]);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Upload video modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<string>("");
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Edit video modal
  const [editingVideo, setEditingVideo] = useState<TutorialRecord | null>(null);
  const [editVideoTitle, setEditVideoTitle] = useState("");
  const [editVideoDuration, setEditVideoDuration] = useState("");

  // Preview video modal
  const [previewVideo, setPreviewVideo] = useState<TutorialRecord | null>(null);

  // Upload Exam PDF modal
  const [examUploadOpen, setExamUploadOpen] = useState(false);
  const [examDocTitle, setExamDocTitle] = useState("");
  const [examDocFile, setExamDocFile] = useState<File | null>(null);
  const [examDocActivate, setExamDocActivate] = useState(true);
  const [uploadingExamDoc, setUploadingExamDoc] = useState(false);

  // Question modal (create or edit)
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestionRecord | null>(null);
  const [qTopic, setQTopic] = useState("");
  const [qPrompt, setQPrompt] = useState("");
  const [qOptions, setQOptions] = useState<ExamOption[]>(EMPTY_OPTIONS);
  const [qCorrectId, setQCorrectId] = useState("a");
  const [qCritical, setQCritical] = useState(false);
  const [qActive, setQActive] = useState(true);
  const [qSortOrder, setQSortOrder] = useState(1);

  const notify = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    const [t, q, docs] = await Promise.all([
      adminApi.listTutorials(),
      adminApi.listExamQuestions(),
      adminApi.listExamDocuments().catch(() => [] as ExamDocumentRecord[]),
    ]);
    setTutorials(t);
    setQuestions(q);
    setExamDocs(docs);
  };

  useEffect(() => {
    void Promise.all([
      adminApi.listTutorials(),
      adminApi.listExamQuestions(),
      adminApi.listExamDocuments().catch(() => [] as ExamDocumentRecord[]),
    ])
      .then(([t, q, docs]) => {
        setTutorials(t);
        setQuestions(q);
        setExamDocs(docs);
      })
      .catch((err) => notify(errorMessage(err), true));
  }, []);

  const handleFileChange = (file: File | null) => {
    setVideoFile(file);
    if (!file) {
      setVideoDuration("");
      return;
    }
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setVideoDuration(String(Math.round(el.duration)));
      }
      URL.revokeObjectURL(url);
    };
    el.onerror = () => URL.revokeObjectURL(url);
  };

  const handleUploadVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoFile) return;
    setUploadingVideo(true);
    try {
      await adminApi.uploadTutorial({
        title: videoTitle.trim(),
        file: videoFile,
        durationSeconds: videoDuration ? Number(videoDuration) : undefined,
      });
      setUploadOpen(false);
      setVideoTitle("");
      setVideoFile(null);
      setVideoDuration("");
      await load();
      notify("Tutorial video uploaded.");
    } catch (err) {
      notify(errorMessage(err), true);
    } finally {
      setUploadingVideo(false);
    }
  };

  const openEditVideo = (t: TutorialRecord) => {
    setEditingVideo(t);
    setEditVideoTitle(t.title);
    setEditVideoDuration(t.durationSeconds ? String(t.durationSeconds) : "");
  };

  const saveEditVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo || !editVideoTitle.trim()) return;
    try {
      await adminApi.updateTutorial(editingVideo.id, {
        title: editVideoTitle.trim(),
        durationSeconds: editVideoDuration ? Number(editVideoDuration) : null,
      });
      setEditingVideo(null);
      await load();
      notify("Tutorial metadata updated.");
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const toggleActiveVideo = async (t: TutorialRecord) => {
    try {
      if (t.isActive) {
        await adminApi.updateTutorial(t.id, { isActive: false });
        notify("Tutorial moved to Draft.");
      } else {
        await adminApi.activateTutorial(t.id);
        notify("Tutorial activated for applicants.");
      }
      await load();
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const handleUploadExamDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDocFile) return;
    setUploadingExamDoc(true);
    try {
      await adminApi.uploadExamDocument({
        title: examDocTitle.trim() || undefined,
        file: examDocFile,
        activate: examDocActivate,
      });
      setExamUploadOpen(false);
      setExamDocTitle("");
      setExamDocFile(null);
      setExamDocActivate(true);
      await load();
      notify("Exam PDF uploaded.");
    } catch (err) {
      notify(errorMessage(err), true);
    } finally {
      setUploadingExamDoc(false);
    }
  };

  const toggleActiveExamDoc = async (doc: ExamDocumentRecord) => {
    try {
      if (doc.isActive) {
        await adminApi.deactivateExamDocument(doc.id);
        notify("Exam PDF deactivated.");
      } else {
        await adminApi.activateExamDocument(doc.id);
        notify("Exam PDF activated for applicants.");
      }
      await load();
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQTopic("");
    setQPrompt("");
    setQOptions(EMPTY_OPTIONS.map((o) => ({ ...o })));
    setQCorrectId("a");
    setQCritical(false);
    setQActive(true);
    setQSortOrder(questions.length + 1);
    setQuestionModalOpen(true);
  };

  const openEditQuestion = (q: ExamQuestionRecord) => {
    setEditingQuestion(q);
    setQTopic(q.topic);
    setQPrompt(q.prompt);
    setQOptions(q.options.map((o) => ({ ...o })));
    setQCorrectId(q.correctOptionId);
    setQCritical(q.isCritical);
    setQActive(q.isActive);
    setQSortOrder(q.sortOrder);
    setQuestionModalOpen(true);
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qTopic.trim() || !qPrompt.trim() || qOptions.some((o) => !o.label.trim())) return;

    try {
      if (editingQuestion) {
        await adminApi.updateExamQuestion(editingQuestion.id, {
          topic: qTopic.trim(),
          prompt: qPrompt.trim(),
          options: qOptions.map((o) => ({ ...o, label: o.label.trim() })),
          correctOptionId: qCorrectId,
          isCritical: qCritical,
          isActive: qActive,
          sortOrder: qSortOrder,
        });
        notify("Assessment question updated.");
      } else {
        await adminApi.createExamQuestion({
          topic: qTopic.trim(),
          prompt: qPrompt.trim(),
          options: qOptions.map((o) => ({ ...o, label: o.label.trim() })),
          correctOptionId: qCorrectId,
          isCritical: qCritical,
          isActive: qActive,
          sortOrder: qSortOrder,
        });
        notify("Assessment question added.");
      }
      setQuestionModalOpen(false);
      await load();
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const toggleQuestionActive = async (q: ExamQuestionRecord) => {
    try {
      await adminApi.updateExamQuestion(q.id, { isActive: !q.isActive });
      await load();
      notify(q.isActive ? "Question deactivated." : "Question activated.");
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  const removeQuestion = async (q: ExamQuestionRecord) => {
    try {
      await adminApi.deleteExamQuestion(q.id);
      await load();
      notify("Question removed.");
    } catch (err) {
      notify(errorMessage(err), true);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed right-6 bottom-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.isError ? "bg-[#b42318]" : "bg-navy"
          }`}
        >
          {toast.text}
        </div>
      )}

      <PageHeader
        kicker="Enablement & Vetting"
        title="Tutorials & Verification Assessment"
        description="Upload training videos and exam documents for applicants, and manage the automated multiple-choice assessment questions."
        actions={
          tab === "CONTENT" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExamUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-soft"
              >
                Upload Exam PDF
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-dark"
              >
                <Icon name="play" size={16} />
                Upload Tutorial Video
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openNewQuestion}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-dark"
            >
              <Icon name="shield" size={16} />
              Add Test Question
            </button>
          )
        }
      />

      <div className="grid w-full grid-cols-2 rounded-xl border border-line bg-white/80 p-1 backdrop-blur-sm sm:inline-flex sm:w-auto">
        <button
          type="button"
          onClick={() => setTab("CONTENT")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-1.5 ${
            tab === "CONTENT" ? "bg-navy text-white shadow-xs" : "text-muted hover:text-navy"
          }`}
        >
          Videos &amp; Exam Uploads ({tutorials.length + examDocs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("ASSESSMENT")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-1.5 ${
            tab === "ASSESSMENT" ? "bg-navy text-white shadow-xs" : "text-muted hover:text-navy"
          }`}
        >
          Assessment Questions ({questions.length})
        </button>
      </div>

      {tab === "CONTENT" ? (
        <div className="space-y-8">
          {/* Tutorial Videos Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy">Tutorial Videos ({tutorials.length})</h2>
                <p className="text-xs text-muted">
                  Training videos applicants must watch before taking the verification assessment.
                </p>
              </div>
            </div>

            {tutorials.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white p-8 text-center text-xs text-muted">
                No tutorial videos uploaded yet. Click &ldquo;Upload Tutorial Video&rdquo; to add one.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tutorials.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{ animationDelay: `${idx * 50}ms` }}
                    className="glass-card stagger-enter flex flex-col justify-between rounded-2xl p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate rounded-md bg-soft px-2.5 py-1 text-[11px] font-semibold text-navy">
                          {t.storagePath}
                        </span>
                        <Badge tone={t.isActive ? "green" : "amber"}>{t.isActive ? "Active" : "Draft"}</Badge>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-navy">{t.title}</h3>
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                        <Icon name="clock" size={14} /> {formatDuration(t.durationSeconds)} · Added{" "}
                        {t.createdAt.slice(0, 10)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewVideo(t)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                        >
                          <Icon name="play" size={12} />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditVideo(t)}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                        >
                          Edit
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleActiveVideo(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          t.isActive
                            ? "border border-line text-navy hover:bg-soft"
                            : "bg-green text-white hover:bg-green-dark"
                        }`}
                      >
                        {t.isActive ? "Set Draft" : "Activate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Uploaded Exam Documents Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy">Uploaded Exam Documents ({examDocs.length})</h2>
                <p className="text-xs text-muted">
                  PDF exam guides or study briefs available to applicants alongside the automated assessment.
                </p>
              </div>
            </div>

            {examDocs.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white p-8 text-center text-xs text-muted">
                No exam PDFs uploaded yet. Click &ldquo;Upload Exam PDF&rdquo; to add one.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {examDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="glass-card flex flex-col justify-between rounded-2xl p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-soft px-2.5 py-1 text-[11px] font-semibold text-navy">
                          v{doc.version} · PDF
                        </span>
                        <Badge tone={doc.isActive ? "green" : "amber"}>
                          {doc.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-navy">{doc.title}</h3>
                      <p className="mt-1 truncate text-xs text-muted" title={doc.fileName}>
                        {doc.fileName} · {formatBytes(doc.sizeBytes)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Uploaded {doc.createdAt.slice(0, 10)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                      >
                        View PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => toggleActiveExamDoc(doc)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          doc.isActive
                            ? "border border-line text-navy hover:bg-soft"
                            : "bg-green text-white hover:bg-green-dark"
                        }`}
                      >
                        {doc.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white/90 px-4 py-3 text-xs text-navy">
            <span className="font-bold">Automated Grading Enabled:</span> Applicants are automatically graded against active questions on submission. Questions marked{" "}
            <span className="font-semibold text-[#b42318]">Critical</span> automatically fail the attempt if answered incorrectly.
          </div>

          {questions.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-8 text-center text-xs text-muted">
              No assessment questions configured yet. Click &ldquo;Add Test Question&rdquo; to create your first question.
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                style={{ animationDelay: `${idx * 45}ms` }}
                className="glass-card stagger-enter rounded-2xl p-5"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-bold text-navy">
                        #{q.sortOrder} · {q.topic}
                      </span>
                      {q.isCritical && <Badge tone="red">Critical</Badge>}
                      <Badge tone={q.isActive ? "green" : "amber"}>{q.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                    <h3 className="mt-2.5 text-sm font-bold text-navy">{q.prompt}</h3>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditQuestion(q)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleQuestionActive(q)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-soft"
                    >
                      {q.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q)}
                      className="rounded-lg border border-[#f9c8c4] bg-[#fff0ef] px-3 py-1.5 text-xs font-semibold text-[#b42318] hover:bg-[#ffe4e2]"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isCorrect = opt.id === q.correctOptionId;
                    return (
                      <li
                        key={opt.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                          isCorrect
                            ? "border-green/35 bg-green-soft/60 font-semibold text-green-dark"
                            : "border-line bg-soft/40 text-ink"
                        }`}
                      >
                        <span className="uppercase">{opt.id}.</span>
                        <span className="flex-1">{opt.label}</span>
                        {isCorrect && <Icon name="check" size={14} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Upload Tutorial Video Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleUploadVideoSubmit} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy">Upload Tutorial Video</h3>
            <p className="mt-1 text-xs text-muted">
              Upload an MP4, WebM, or MOV training video for shopper applicants. New uploads start as Draft until activated.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy">Video Title</label>
                <input
                  required
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g. Receipt-First Transparency & Anti-Scam"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy">Video File</label>
                <input
                  required
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-xl border border-line px-3 py-2 text-xs text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy">Duration (seconds, optional)</label>
                <input
                  type="number"
                  min={1}
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value)}
                  placeholder="Auto-detected when possible"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingVideo || !videoTitle.trim() || !videoFile}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {uploadingVideo ? "Uploading..." : "Upload Video"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Exam PDF Modal */}
      {examUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleUploadExamDocSubmit} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy">Upload Exam PDF</h3>
            <p className="mt-1 text-xs text-muted">
              Upload a PDF exam brief or study document for applicants.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy">Document Title (optional)</label>
                <input
                  type="text"
                  value={examDocTitle}
                  onChange={(e) => setExamDocTitle(e.target.value)}
                  placeholder="e.g. PSASA Verification Exam Guide"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy">PDF File</label>
                <input
                  required
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setExamDocFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-xl border border-line px-3 py-2 text-xs text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-navy">
                <input
                  type="checkbox"
                  checked={examDocActivate}
                  onChange={(e) => setExamDocActivate(e.target.checked)}
                  className="accent-green"
                />
                Activate immediately for applicants
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExamUploadOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingExamDoc || !examDocFile}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {uploadingExamDoc ? "Uploading..." : "Upload PDF"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Tutorial Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form onSubmit={saveEditVideo} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy">Edit Tutorial Metadata</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy">Video Title</label>
                <input
                  required
                  type="text"
                  value={editVideoTitle}
                  onChange={(e) => setEditVideoTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-navy">Duration (seconds)</label>
                <input
                  type="number"
                  min={1}
                  value={editVideoDuration}
                  onChange={(e) => setEditVideoDuration(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-2"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Video Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy">{previewVideo.title}</h3>
                <p className="text-xs text-muted">
                  {previewVideo.storagePath} · {formatDuration(previewVideo.durationSeconds)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="rounded-lg border border-line p-1.5 text-muted hover:text-navy"
                aria-label="Close preview"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl bg-navy">
              {previewVideo.previewUrl || !adminApi.isMockMode() ? (
                <video
                  controls
                  className="max-h-96 w-full"
                  src={previewVideo.previewUrl ?? `/api/tutorials/${previewVideo.id}/stream`}
                />
              ) : (
                <div className="flex h-56 flex-col items-center justify-center px-6 text-center text-white/80">
                  <Icon name="play" size={28} className="text-sand" />
                  <p className="mt-2 text-sm font-semibold">Seeded sandbox video placeholder</p>
                  <p className="mt-1 text-xs text-white/60">
                    Upload a real video file via &ldquo;Upload Tutorial Video&rdquo; to preview playback in sandbox mode, or connect the PSASA backend to stream stored videos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {questionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={saveQuestion}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-navy">
              {editingQuestion ? "Edit Assessment Question" : "Add Assessment Question"}
            </h3>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-navy">Topic</label>
                  <input
                    required
                    type="text"
                    value={qTopic}
                    onChange={(e) => setQTopic(e.target.value)}
                    placeholder="e.g. Receipt Transparency"
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy">Sort Order</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={qSortOrder}
                    onChange={(e) => setQSortOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy">Question Prompt</label>
                <textarea
                  required
                  rows={2}
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-green focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-navy">Answer Options (select correct answer)</label>
                {qOptions.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={qCorrectId === opt.id}
                      onChange={() => setQCorrectId(opt.id)}
                      className="accent-green"
                      aria-label={`Mark option ${opt.id} as correct`}
                    />
                    <span className="w-4 text-xs font-bold uppercase text-muted">{opt.id}.</span>
                    <input
                      required
                      type="text"
                      value={opt.label}
                      onChange={(e) =>
                        setQOptions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)),
                        )
                      }
                      placeholder={`Option ${opt.id.toUpperCase()}`}
                      className="flex-1 rounded-xl border border-line px-3 py-1.5 text-sm focus:border-green focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs text-navy">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={qCritical}
                    onChange={(e) => setQCritical(e.target.checked)}
                    className="accent-green"
                  />
                  Critical question (auto-fails attempt if missed)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={qActive}
                    onChange={(e) => setQActive(e.target.checked)}
                    className="accent-green"
                  />
                  Active in applicant exam
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark"
              >
                {editingQuestion ? "Save Question" : "Add Question"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
