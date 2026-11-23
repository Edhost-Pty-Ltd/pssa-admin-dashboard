import {
  initialApplications,
  initialAuditLogs,
  initialCases,
  initialExamQuestions,
  initialListings,
  initialMembers,
  initialNotifications,
  initialSettings,
  initialTutorials,
} from "../data/mockAdminData";
import type {
  AdminSettings,
  ApplicationStatus,
  AuditEntry,
  CaseRecord,
  CaseStatus,
  DocumentStatus,
  ExamQuestionRecord,
  ListingRecord,
  ListingStatus,
  MemberRecord,
  MemberStatus,
  NotificationItem,
  TutorialRecord,
  VerificationApplication,
  VerificationDecision,
} from "../types/admin";
import { api } from "./api";

/**
 * Safe frontend isolation flag:
 * - true  => uses in-memory mock data so the admin dashboard can be edited & tested without backend dependencies.
 * - false => routes calls to the PSASA backend via src/lib/api.ts.
 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false";

const store = {
  applications: structuredClone(initialApplications),
  members: structuredClone(initialMembers),
  listings: structuredClone(initialListings),
  cases: structuredClone(initialCases),
  tutorials: structuredClone(initialTutorials),
  examQuestions: structuredClone(initialExamQuestions),
  audit: structuredClone(initialAuditLogs),
  notifications: structuredClone(initialNotifications),
  settings: structuredClone(initialSettings),
};

function recordAudit(action: string, target: string, category: AuditEntry["category"]) {
  store.audit = [
    {
      id: `aud-${Date.now()}`,
      actor: "Admin (Sandbox)",
      action,
      target,
      category,
      timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
    },
    ...store.audit,
  ];
}

export const adminApi = {
  isMockMode: () => USE_MOCK_API,

  async getOverview() {
    if (!USE_MOCK_API) {
      return api<{
        applications: VerificationApplication[];
        members: MemberRecord[];
        cases: CaseRecord[];
        listings: ListingRecord[];
      }>("/admin/overview");
    }
    return {
      applications: store.applications,
      members: store.members,
      cases: store.cases,
      listings: store.listings,
    };
  },

  async listApplications(): Promise<VerificationApplication[]> {
    if (!USE_MOCK_API) return api<VerificationApplication[]>("/admin/applications");
    return [...store.applications];
  },

  async getApplication(id: string): Promise<{ profile: VerificationApplication | null }> {
    if (!USE_MOCK_API) {
      return api<{ profile: VerificationApplication }>(`/admin/applications/${id}`);
    }
    return {
      profile: store.applications.find((a) => a.id === id) ?? null,
    };
  },

  async recordVerificationDecision(
    id: string,
    decision: VerificationDecision,
    reason?: string,
    checks?: { identity: boolean; contact: boolean; qualifications: boolean; conduct: boolean; method?: string },
  ): Promise<VerificationApplication> {
    if (!USE_MOCK_API) {
      const res = await api<{ profile: VerificationApplication }>(`/admin/verifications/${id}/decision`, {
        method: "POST",
        body: { decision, reason, checks },
      });
      return res.profile;
    }
    const statusMap: Record<VerificationDecision, ApplicationStatus> = {
      UNDER_REVIEW: "UNDER_REVIEW",
      INFO_REQUIRED: "INFO_REQUIRED",
      APPROVED: "VERIFIED",
      REJECTED: "REJECTED",
      SUSPENDED: "SUSPENDED",
      REINSTATED: "VERIFIED",
    };
    const nextStatus = statusMap[decision];
    const nowIso = new Date().toISOString();
    const nextExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    store.applications = store.applications.map((a) => {
      if (a.id !== id) return a;
      recordAudit(`Recorded decision ${decision}`, `${a.referenceCode} — ${a.applicantName}`, "VERIFICATION");
      return {
        ...a,
        status: nextStatus,
        statusFeedback: decision === "INFO_REQUIRED" || decision === "REJECTED" || decision === "SUSPENDED" ? reason : undefined,
        certificateNumber:
          decision === "APPROVED" || decision === "REINSTATED"
            ? a.certificateNumber ?? `PSSA-CERT-2026-${a.id.replace(/\D/g, "").padStart(4, "0")}`
            : a.certificateNumber,
        verificationExpiresAt:
          decision === "APPROVED" || decision === "REINSTATED" ? nextExpiry : a.verificationExpiresAt,
        decisions: [
          {
            id: `dec-${Date.now()}`,
            decision,
            reason,
            reviewer: "Admin (Sandbox)",
            createdAt: nowIso,
          },
          ...a.decisions,
        ],
      };
    });
    return store.applications.find((a) => a.id === id)!;
  },

  async reviewApplicationDoc(appId: string, docId: string, status: Exclude<DocumentStatus, "PENDING">, note?: string): Promise<VerificationApplication> {
    if (!USE_MOCK_API) {
      const res = await api<{ profile: VerificationApplication }>(`/admin/verifications/${appId}/documents/${docId}`, {
        method: "POST",
        body: { status, note },
      });
      return res.profile;
    }
    store.applications = store.applications.map((a) =>
      a.id === appId
        ? {
            ...a,
            documents: a.documents.map((d) =>
              d.id === docId
                ? { ...d, status, verified: status === "ACCEPTED", reviewerNote: status === "REJECTED" ? note : undefined }
                : d,
            ),
          }
        : a,
    );
    return store.applications.find((a) => a.id === appId)!;
  },

  async allowExamRetake(appId: string, attemptId: string, reason: string): Promise<VerificationApplication> {
    if (!USE_MOCK_API) {
      await api(`/exam/attempts/${attemptId}/allow-retake`, {
        method: "POST",
        body: { reason, conflictDeclared: true },
      });
      const res = await api<{ profile: VerificationApplication }>(`/admin/applications/${appId}`);
      return res.profile;
    }
    store.applications = store.applications.map((a) => {
      if (a.id !== appId) return a;
      recordAudit("Unlocked assessment retake", `${a.referenceCode} — ${a.applicantName}`, "ASSESSMENT");
      return {
        ...a,
        assessments: a.assessments.map((asm) => (asm.id === attemptId ? { ...asm, retakeUnlocked: true } : asm)),
      };
    });
    return store.applications.find((a) => a.id === appId)!;
  },

  async toggleApplicationChannel(appId: string, channelId: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/verifications/${appId}/channels/${channelId}`, { method: "PATCH" });
      return;
    }
    store.applications = store.applications.map((a) =>
      a.id === appId
        ? { ...a, channels: a.channels.map((ch) => (ch.id === channelId ? { ...ch, confirmed: !ch.confirmed } : ch)) }
        : a,
    );
  },

  async listMembers(): Promise<MemberRecord[]> {
    if (!USE_MOCK_API) return api<MemberRecord[]>("/admin/members");
    return [...store.members];
  },

  async updateMemberStatus(id: string, status: MemberStatus): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/members/${id}/status`, { method: "POST", body: { status } });
      return;
    }
    store.members = store.members.map((m) => {
      if (m.id !== id) return m;
      recordAudit(`Updated shopper standing to ${status}`, `${m.memberNumber} — ${m.fullName}`, "MEMBER");
      return { ...m, status };
    });
  },

  async listListings(): Promise<ListingRecord[]> {
    if (!USE_MOCK_API) return api<ListingRecord[]>("/admin/listings");
    return [...store.listings];
  },

  async updateListingStatus(id: string, status: ListingStatus): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/listings/${id}`, { method: "PATCH", body: { status } });
      return;
    }
    store.listings = store.listings.map((l) => {
      if (l.id !== id) return l;
      recordAudit(`Set specialty profile ${status}`, l.title, "LISTING");
      return { ...l, status };
    });
  },

  async listCases(): Promise<CaseRecord[]> {
    if (!USE_MOCK_API) return api<CaseRecord[]>("/admin/cases");
    return [...store.cases];
  },

  async updateCase(id: string, status: CaseStatus, resolutionNotes: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/cases/${id}`, { method: "PATCH", body: { status, resolutionNotes } });
      return;
    }
    store.cases = store.cases.map((c) => {
      if (c.id !== id) return c;
      recordAudit(`Updated safety case to ${status}`, c.caseNumber, "CASE");
      return { ...c, status, resolutionNotes };
    });
  },

  async listTutorials(): Promise<TutorialRecord[]> {
    if (!USE_MOCK_API) {
      const res = await api<{ tutorials: TutorialRecord[] }>("/tutorials");
      return res.tutorials;
    }
    return [...store.tutorials];
  },

  async uploadTutorial(input: { title: string; file: File; durationSeconds?: number }): Promise<TutorialRecord> {
    if (!USE_MOCK_API) {
      const form = new FormData();
      form.append("title", input.title);
      if (input.durationSeconds) form.append("durationSeconds", String(input.durationSeconds));
      form.append("file", input.file);
      const res = await api<{ tutorial: TutorialRecord }>("/tutorials", { method: "POST", body: form });
      return res.tutorial;
    }
    const previewUrl = URL.createObjectURL(input.file);
    const created: TutorialRecord = {
      id: `tut-${Date.now()}`,
      title: input.title,
      durationSeconds: input.durationSeconds ?? null,
      isActive: false,
      storagePath: input.file.name,
      uploadedById: "admin-1",
      createdAt: new Date().toISOString(),
      previewUrl,
    };
    store.tutorials = [...store.tutorials, created];
    recordAudit("Uploaded tutorial video", created.title, "TUTORIAL");
    return created;
  },

  async updateTutorial(
    id: string,
    patch: { title?: string; durationSeconds?: number | null; isActive?: boolean },
  ): Promise<TutorialRecord> {
    if (!USE_MOCK_API) {
      const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}`, { method: "PATCH", body: patch });
      return res.tutorial;
    }
    store.tutorials = store.tutorials.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const updated = store.tutorials.find((t) => t.id === id)!;
    recordAudit(
      patch.isActive !== undefined ? `${patch.isActive ? "Activated" : "Deactivated"} tutorial` : "Updated tutorial metadata",
      updated.title,
      "TUTORIAL",
    );
    return updated;
  },

  async activateTutorial(id: string): Promise<TutorialRecord> {
    if (!USE_MOCK_API) {
      const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}/activate`, { method: "POST" });
      return res.tutorial;
    }
    return this.updateTutorial(id, { isActive: true });
  },

  async listExamQuestions(): Promise<ExamQuestionRecord[]> {
    if (!USE_MOCK_API) {
      const res = await api<{ questions: ExamQuestionRecord[] }>("/exam/questions");
      return res.questions;
    }
    return [...store.examQuestions].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async createExamQuestion(
    input: Omit<ExamQuestionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ExamQuestionRecord> {
    if (!USE_MOCK_API) {
      const res = await api<{ question: ExamQuestionRecord }>("/exam/questions", { method: "POST", body: input });
      return res.question;
    }
    const now = new Date().toISOString();
    const created: ExamQuestionRecord = {
      ...input,
      id: `q-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    store.examQuestions = [...store.examQuestions, created];
    recordAudit("Added assessment question", created.topic, "ASSESSMENT");
    return created;
  },

  async updateExamQuestion(
    id: string,
    patch: Partial<Omit<ExamQuestionRecord, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ExamQuestionRecord> {
    if (!USE_MOCK_API) {
      const res = await api<{ question: ExamQuestionRecord }>(`/exam/questions/${id}`, {
        method: "PATCH",
        body: patch,
      });
      return res.question;
    }
    const now = new Date().toISOString();
    store.examQuestions = store.examQuestions.map((q) => (q.id === id ? { ...q, ...patch, updatedAt: now } : q));
    const updated = store.examQuestions.find((q) => q.id === id)!;
    recordAudit("Updated assessment question", updated.topic, "ASSESSMENT");
    return updated;
  },

  async deleteExamQuestion(id: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/exam/questions/${id}`, { method: "DELETE" });
      return;
    }
    const target = store.examQuestions.find((q) => q.id === id);
    store.examQuestions = store.examQuestions.filter((q) => q.id !== id);
    if (target) recordAudit("Removed assessment question", target.topic, "ASSESSMENT");
  },

  async listAudit(): Promise<AuditEntry[]> {
    if (!USE_MOCK_API) return api<AuditEntry[]>("/admin/audit");
    return [...store.audit];
  },

  async listNotifications(): Promise<NotificationItem[]> {
    if (!USE_MOCK_API) return api<NotificationItem[]>("/admin/notifications");
    return [...store.notifications];
  },

  async markAllNotificationsRead(): Promise<void> {
    if (!USE_MOCK_API) {
      await api("/admin/notifications/read-all", { method: "POST" });
      return;
    }
    store.notifications = store.notifications.map((n) => ({ ...n, read: true }));
  },

  async getSettings(): Promise<AdminSettings> {
    if (!USE_MOCK_API) return api<AdminSettings>("/admin/settings");
    return { ...store.settings };
  },

  async saveSettings(next: AdminSettings): Promise<AdminSettings> {
    if (!USE_MOCK_API) return api<AdminSettings>("/admin/settings", { method: "PUT", body: next });
    store.settings = { ...next };
    recordAudit("Updated association settings", next.associationName, "SETTINGS");
    return { ...store.settings };
  },
};
