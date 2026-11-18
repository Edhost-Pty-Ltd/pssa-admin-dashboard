import {
  initialApplications,
  initialAuditLogs,
  initialBookings,
  initialCases,
  initialCategories,
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
  BookingRecord,
  BookingStatus,
  CaseRecord,
  CaseStatus,
  ListingRecord,
  ListingStatus,
  MemberRecord,
  MemberStatus,
  NotificationItem,
  ServiceCategory,
  TutorialRecord,
  VerificationApplication,
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
  listings: structuredClone(initialListings),
  bookings: structuredClone(initialBookings),
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
    if (!USE_MOCK_API) return api<{
      applications: VerificationApplication[];
      categories: ServiceCategory[];
      members: MemberRecord[];
      bookings: BookingRecord[];
      cases: CaseRecord[];
      listings: ListingRecord[];
    }>("/admin/overview");
    return {
      applications: store.applications,
      categories: store.categories,
      members: store.members,
      bookings: store.bookings,
      cases: store.cases,
      listings: store.listings,
    };
  },

  // Categories
  async listCategories(): Promise<ServiceCategory[]> {
    if (!USE_MOCK_API) return api<ServiceCategory[]>("/admin/categories");
    return [...store.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async saveCategory(input: Omit<ServiceCategory, "id" | "providerCount" | "listingCount"> & { id?: string }): Promise<ServiceCategory> {
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

  // Verifications / Applications
  async listApplications(): Promise<VerificationApplication[]> {
    if (!USE_MOCK_API) return api<VerificationApplication[]>("/admin/verifications");
    return [...store.applications];
  },

  async getApplication(id: string): Promise<VerificationApplication | null> {
    if (!USE_MOCK_API) return api<VerificationApplication>(`/admin/verifications/${id}`);
    return store.applications.find((a) => a.id === id) ?? null;
  },

  async updateApplicationStatus(id: string, status: ApplicationStatus, reviewerNotes: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/verifications/${id}`, { method: "PATCH", body: { status, reviewerNotes } });
      return;
    }
    store.applications = store.applications.map((a) => {
      if (a.id !== id) return a;
      recordAudit(`Set application ${status}`, `${a.referenceCode} — ${a.applicantName}`, "VERIFICATION");
      return { ...a, status, reviewerNotes };
    });
  },

  async toggleApplicationDoc(appId: string, docId: string): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/verifications/${appId}/documents/${docId}`, { method: "PATCH" });
      return;
    }
    store.applications = store.applications.map((a) =>
      a.id === appId
        ? { ...a, documents: a.documents.map((d) => (d.id === docId ? { ...d, verified: !d.verified } : d)) }
        : a,
    );
  },

  // Members
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
      recordAudit(`Updated member status to ${status}`, `${m.memberNumber} — ${m.fullName}`, "MEMBER");
      return { ...m, status };
    });
  },

  // Listings
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
      recordAudit(`Set listing ${status}`, l.title, "LISTING");
      return { ...l, status };
    });
  },

  // Bookings
  async listBookings(): Promise<BookingRecord[]> {
    if (!USE_MOCK_API) return api<BookingRecord[]>("/admin/bookings");
    return [...store.bookings];
  },

  async updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
    if (!USE_MOCK_API) {
      await api(`/admin/bookings/${id}`, { method: "PATCH", body: { status } });
      return;
    }
    store.bookings = store.bookings.map((b) => (b.id === id ? { ...b, status } : b));
  },

  // Cases / Complaints
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
      recordAudit(`Updated case to ${status}`, c.caseNumber, "CASE");
      return { ...c, status, resolutionNotes };
    });
  },

  // Tutorials
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

  // Audit & Notifications & Settings
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
