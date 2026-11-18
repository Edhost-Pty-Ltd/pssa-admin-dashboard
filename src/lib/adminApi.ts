import {
  initialApplications,
  initialAuditLogs,
  initialCases,
  initialCategories,
  initialCustomers,
  initialListings,
  initialMembers,
  initialNotifications,
  initialSettings,
  initialTutorials,
  trialRubric,
} from "../data/mockAdminData";
import type {
  AdminSettings,
  ApplicationStatus,
  AuditEntry,
  CaseRecord,
  CaseStatus,
  CustomerMemberRecord,
  CustomerStatus,
  DocumentStatus,
  ListingRecord,
  ListingStatus,
  MemberRecord,
  MemberStatus,
  NotificationItem,
  ServiceCategory,
  TutorialRecord,
  VerificationApplication,
  VerificationDecision,
} from "../types/admin";
import { api } from "./api";

/**
 * Safe frontend isolation flag:
 * - true  => uses in-memory mock data so the admin dashboard can be edited & tested without backend dependencies.
 * - false => routes calls to /api/admin/* via src/lib/api.ts when backend endpoints are ready.
 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false";

let store = {
  categories: structuredClone(initialCategories),
  applications: structuredClone(initialApplications),
  members: structuredClone(initialMembers),
  customers: structuredClone(initialCustomers),
  listings: structuredClone(initialListings),
  cases: structuredClone(initialCases),
  tutorials: structuredClone(initialTutorials),
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
        categories: ServiceCategory[];
        members: MemberRecord[];
        customers: CustomerMemberRecord[];
        cases: CaseRecord[];
        listings: ListingRecord[];
      }>("/admin/overview");
    }
    return {
      applications: store.applications,
      categories: store.categories,
      members: store.members,
      customers: store.customers,
      cases: store.cases,
      listings: store.listings,
    };
  },

  async listCategories(): Promise<ServiceCategory[]> {
    if (!USE_MOCK_API) return api<ServiceCategory[]>("/admin/categories");
    return [...store.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async saveCategory(
    input: Omit<ServiceCategory, "id" | "providerCount" | "listingCount"> & { id?: string },
  ): Promise<ServiceCategory> {
    if (!USE_MOCK_API) {
      return api<ServiceCategory>(input.id ? `/admin/categories/${input.id}` : "/admin/categories", {
        method: input.id ? "PATCH" : "POST",
        body: input,
      });
    }
    if (input.id) {
      store.categories = store.categories.map((c) => (c.id === input.id ? { ...c, ...input } : c));
      recordAudit("Updated service category", input.name, "CATEGORY");
      return store.categories.find((c) => c.id === input.id)!;
    }
    const created: ServiceCategory = {
      ...input,
      id: `cat-${Date.now()}`,
      providerCount: 0,
      listingCount: 0,
    };
    store.categories = [...store.categories, created];
    recordAudit("Created service category", created.name, "CATEGORY");
    return created;
  },

  async toggleCategory(id: string): Promise<void> {
    if (!USE_MOCK_API) {
      const target = store.categories.find((c) => c.id === id);
      await api(`/admin/categories/${id}`, { method: "PATCH", body: { isActive: !target?.isActive } });
      return;
    }
    store.categories = store.categories.map((c) => {
      if (c.id !== id) return c;
      recordAudit(c.isActive ? "Deactivated category" : "Activated category", c.name, "CATEGORY");
      return { ...c, isActive: !c.isActive };
    });
  },

  async deleteCategory(id: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/categories/${id}`, { method: "DELETE" });
      return;
    }
    const target = store.categories.find((c) => c.id === id);
    store.categories = store.categories.filter((c) => c.id !== id);
    if (target) recordAudit("Deleted category", target.name, "CATEGORY");
  },

  async listApplications(): Promise<VerificationApplication[]> {
    if (!USE_MOCK_API) return api<VerificationApplication[]>("/admin/verifications");
    return [...store.applications];
  },

  async getApplication(id: string): Promise<{ profile: VerificationApplication | null; trialRubric: { id: string; label: string }[] }> {
    if (!USE_MOCK_API) {
      return api<{ profile: VerificationApplication; trialRubric: { id: string; label: string }[] }>(`/admin/verifications/${id}`);
    }
    return {
      profile: store.applications.find((a) => a.id === id) ?? null,
      trialRubric,
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

  async resetAssessment(appId: string): Promise<VerificationApplication> {
    if (!USE_MOCK_API) {
      const res = await api<{ profile: VerificationApplication }>(`/admin/verifications/${appId}/assessment-reset`, {
        method: "POST",
      });
      return res.profile;
    }
    store.applications = store.applications.map((a) => {
      if (a.id !== appId) return a;
      recordAudit("Approved assessment retake", `${a.referenceCode} — ${a.applicantName}`, "VERIFICATION");
      return { ...a, assessments: [] };
    });
    return store.applications.find((a) => a.id === appId)!;
  },

  async reviewTrial(
    appId: string,
    decision: "APPROVED" | "CHANGES_REQUESTED",
    rubric: Record<string, boolean>,
    note?: string,
  ): Promise<VerificationApplication> {
    if (!USE_MOCK_API) {
      const res = await api<{ profile: VerificationApplication }>(`/admin/verifications/${appId}/trial`, {
        method: "POST",
        body: { decision, rubric, note },
      });
      return res.profile;
    }
    const nowIso = new Date().toISOString();
    store.applications = store.applications.map((a) => {
      if (a.id !== appId) return a;
      recordAudit(`Trial video ${decision}`, `${a.referenceCode} — ${a.applicantName}`, "VERIFICATION");
      return {
        ...a,
        trial: {
          ...a.trial,
          status: decision,
          videos: a.trial.videos.map((v, idx) =>
            idx === 0 ? { ...v, status: decision, reviewedAt: nowIso, reviewer: "Admin (Sandbox)", reviewerNote: note } : v,
          ),
        },
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
      await api(`/admin/members/${id}`, { method: "PATCH", body: { status } });
      return;
    }
    store.members = store.members.map((m) => {
      if (m.id !== id) return m;
      recordAudit(`Updated shopper standing to ${status}`, `${m.memberNumber} — ${m.fullName}`, "MEMBER");
      return { ...m, status };
    });
  },

  async listCustomers(): Promise<CustomerMemberRecord[]> {
    if (!USE_MOCK_API) return api<CustomerMemberRecord[]>("/admin/customers");
    return [...store.customers];
  },

  async updateCustomerStatus(id: string, status: CustomerStatus): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/customers/${id}`, { method: "PATCH", body: { status } });
      return;
    }
    store.customers = store.customers.map((c) => {
      if (c.id !== id) return c;
      recordAudit(`Updated customer member to ${status}`, `${c.customerCode} — ${c.fullName}`, "CUSTOMER");
      return { ...c, status };
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
    if (!USE_MOCK_API) return api<TutorialRecord[]>("/admin/tutorials");
    return [...store.tutorials];
  },

  async toggleTutorial(id: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/tutorials/${id}`, { method: "PATCH" });
      return;
    }
    store.tutorials = store.tutorials.map((t) => (t.id === id ? { ...t, published: !t.published } : t));
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
