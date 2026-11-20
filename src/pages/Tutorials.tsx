import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import { errorMessage } from "../lib/api";
import type { ExamOption, ExamQuestionRecord, TutorialRecord } from "../types/admin";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const EMPTY_OPTIONS: ExamOption[] = [
  { id: "a", label: "" },
  { id: "b", label: "" },
  { id: "c", label: "" },
  { id: "d", label: "" },
];

export default function Tutorials() {
  const [tab, setTab] = useState<"VIDEOS" | "ASSESSMENT">("VIDEOS");
  const [tutorials, setTutorials] = useState<TutorialRecord[]>([]);
  const [questions, setQuestions] = useState<ExamQuestionRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Upload video modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Edit video modal
  const [editingVideo, setEditingVideo] = useState<TutorialRecord | null>(null);
  const [editVideoTitle, setEditVideoTitle] = useState("");
  const [editVideoDuration, setEditVideoDuration] = useState("");

  // Preview video modal
  const [previewVideo, setPreviewVideo] = useState<TutorialRecord | null>(null);

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

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    const [t, q] = await Promise.all([adminApi.listTutorials(), adminApi.listExamQuestions()]);
    setTutorials(t);
    setQuestions(q);
  };

  useEffect(() => {
    void Promise.all([adminApi.listTutorials(), adminApi.listExamQuestions()]).then(([t, q]) => {
      setTutorials(t);
      setQuestions(q);
    });
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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoFile) return;
    setUploading(true);
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
      notify(errorMessage(err));
    } finally {
      setUploading(false);
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
    await adminApi.updateTutorial(editingVideo.id, {
      title: editVideoTitle.trim(),
      durationSeconds: editVideoDuration ? Number(editVideoDuration) : null,
    });
    setEditingVideo(null);
    await load();
    notify("Tutorial metadata updated.");
  };

  const toggleActiveVideo = async (t: TutorialRecord) => {
    if (t.isActive) {
      await adminApi.updateTutorial(t.id, { isActive: false });
      notify("Tutorial moved to Draft.");
    } else {
      await adminApi.activateTutorial(t.id);
      notify("Tutorial activated for applicants.");
    }
    await load();
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
  };

  const toggleQuestionActive = async (q: ExamQuestionRecord) => {
    await adminApi.updateExamQuestion(q.id, { isActive: !q.isActive });
    await load();
    notify(q.isActive ? "Question deactivated." : "Question activated.");
  };

  const removeQuestion = async (q: ExamQuestionRecord) => {
    await adminApi.deleteExamQuestion(q.id);
    await load();
    notify("Question removed.");
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        kicker="Enablement & Vetting"
        title="Tutorials & Verification Assessment"
        description="Upload training videos for applicants and manage the verification assessment questions required before approval."
        actions={
          tab === "VIDEOS" ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-dark"
            >
              <Icon name="play" size={16} />
              Upload Tutorial Video
            </button>
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
          onClick={() => setTab("VIDEOS")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-1.5 ${
            tab === "VIDEOS" ? "bg-navy text-white shadow-xs" : "text-muted hover:text-navy"
          }`}
        >
          Tutorial Videos ({tutorials.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("ASSESSMENT")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-1.5 ${
            tab === "ASSESSMENT" ? "bg-navy text-white shadow-xs" : "text-muted hover:text-navy"
          }`}
        >
          Assessment ({questions.length})
        </button>
      </div>

      {tab === "VIDEOS" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((t, idx) => (
            <div
              key={t.id}
              style={{ animationDelay: `${idx * 50}ms` }}
              className="glass-card stagger-enter flex flex-col justify-between rounded-2xl p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-soft px-2.5 py-1 text-[11px] font-semibold text-navy">
                    {t.storagePath}
                  </span>
                  <Badge tone={t.isActive ? "green" : "amber"}>{t.isActive ? "Active" : "Draft"}</Badge>
                </div>
                <h2 className="mt-3 text-base font-bold text-navy">{t.title}</h2>
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
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-soft/60 px-4 py-3 text-xs text-navy">
            <strong>Assessment Bank:</strong> Applicants must pass this verification assessment before admin approval.
            Reading questions maps to <code className="rounded bg-white px-1.5 py-0.5">GET /api/exam/questions</code>;
            creating, editing, and deleting questions here are staged for the upcoming backend endpoints.
          </div>

          {questions.map((q, idx) => (
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
          ))}
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleUploadSubmit} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
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
                disabled={uploading || !videoTitle.trim() || !videoFile}
                className="rounded-xl bg-green px-4 py-2 text-xs font-semibold text-white hover:bg-green-dark disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Video"}
              </button>
            </div>
          </form>
        </div>
      )}

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
                    Upload a real video file via "Upload Tutorial Video" to preview playback in sandbox mode, or connect the PSSA backend to stream stored videos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  Critical safety question
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={qActive}
                    onChange={(e) => setQActive(e.target.checked)}
                    className="accent-green"
                  />
                  Active in assessment
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
