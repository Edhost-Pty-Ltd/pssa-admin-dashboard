import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Badge, PageHeader, statusTone } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { ApplicationStatus, VerificationApplication } from "../types/admin";

export default function VerificationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<VerificationApplication | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    const found = await adminApi.getApplication(id);
    setApp(found);
    if (found) setNotes(found.reviewerNotes);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!app) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">Application not found.</p>
        <Link to="/admin/verifications" className="mt-3 inline-block text-sm font-semibold text-green-dark underline">
          Back to Verifications
        </Link>
      </div>
    );
  }

  const toggleDoc = async (docId: string) => {
    await adminApi.toggleApplicationDoc(app.id, docId);
    await load();
  };

  const setStatus = async (status: ApplicationStatus) => {
    setSaving(true);
    try {
      await adminApi.updateApplicationStatus(app.id, status, notes);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={app.referenceCode}
        title={app.applicantName}
        description={`${app.businessName} · ${app.city}, ${app.province}`}
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/verifications")}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold text-navy hover:bg-soft"
          >
            Back to Queue
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Applicant Profile */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">Applicant Details</h2>
              <Badge tone={statusTone(app.status)}>{app.status.replace("_", " ")}</Badge>
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Email</dt>
                <dd className="mt-0.5 font-medium text-navy">{app.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Phone</dt>
                <dd className="mt-0.5 font-medium text-navy">{app.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">SA ID (Last 4)</dt>
                <dd className="mt-0.5 font-medium text-navy">•••• •••• •{app.saIdLast4}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Experience</dt>
                <dd className="mt-0.5 font-medium text-navy">{app.yearsExperience} years</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-muted">Requested Categories</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {app.categories.map((cat) => (
                    <span key={cat} className="rounded-lg border border-line bg-soft px-2.5 py-1 text-xs font-semibold text-navy">
                      {cat}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          {/* Documents Checklist */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-navy">Verification Documents</h2>
            <div className="space-y-3">
              {app.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon name="file" size={18} className="text-navy" />
                    <div>
                      <p className="text-sm font-semibold text-navy">{doc.label}</p>
                      <p className="text-xs text-muted">
                        {doc.fileName} · Uploaded {doc.uploadedAt}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      doc.verified
                        ? "bg-green-soft text-green-dark"
                        : "border border-line bg-white text-navy hover:bg-soft"
                    }`}
                  >
                    <Icon name="check" size={14} />
                    {doc.verified ? "Verified" : "Mark Verified"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Decision Panel */}
        <aside className="rounded-2xl border border-line bg-white p-6 h-fit">
          <h2 className="text-lg font-bold text-navy">Compliance Decision</h2>
          <p className="mt-1 text-xs text-muted">Add internal notes and update the application status.</p>

          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reviewer notes or requested follow-up..."
            className="mt-4 w-full rounded-xl border border-line p-3 text-sm focus:border-green focus:outline-none"
          />

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => setStatus("APPROVED")}
              className="w-full rounded-lg bg-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-dark disabled:opacity-50"
            >
              Approve &amp; Issue Badge
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setStatus("INFO_REQUESTED")}
              className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-soft disabled:opacity-50"
            >
              Request More Info
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setStatus("REJECTED")}
              className="w-full rounded-lg border border-[#f9c8c4] bg-[#fff0ef] px-4 py-2.5 text-sm font-semibold text-[#b42318] hover:bg-[#ffe4e2] disabled:opacity-50"
            >
              Reject Application
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
