import type {
  AdminSettings,
  ApplicationDocType,
  ApplicationStatus,
  AuditEntry,
  CaseDetailRecord,
  CaseOutcome,
  CaseRecord,
  CaseStatus,
  DocumentStatus,
  ExamDocumentRecord,
  ExamQuestionRecord,
  ListingRecord,
  ListingStatus,
  MemberDetailRecord,
  MemberRecord,
  MemberStatus,
  NotificationItem,
  RenewalChecklistItem,
  RenewalRecord,
  TutorialRecord,
  VerificationApplication,
  VerificationDecision,
} from "../types/admin";
import { api } from "./api";

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { data: unknown; ts: number; promise?: Promise<unknown> }>();

function readSessionCache<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(`pssa_swr:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionCache(key: string, data: unknown) {
  try {
    sessionStorage.setItem(`pssa_swr:${key}`, JSON.stringify(data));
  } catch {
    // ignore quota/private mode errors
  }
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();
  if (entry && now - entry.ts < CACHE_TTL_MS && entry.data !== undefined) {
    return entry.data as T;
  }
  const staleData = (entry?.data ?? readSessionCache<T>(key)) as T | undefined;
  if (!entry?.promise) {
    const promise = fetcher()
      .then((data) => {
        cache.set(key, { data, ts: Date.now() });
        writeSessionCache(key, data);
        return data;
      })
      .catch((err) => {
        if (staleData !== undefined) {
          cache.set(key, { data: staleData, ts: Date.now() });
          return staleData;
        }
        cache.delete(key);
        throw err;
      });
    cache.set(key, { data: staleData, ts: entry?.ts ?? 0, promise });
    if (staleData === undefined) {
      return promise;
    }
  }
  // True Stale-While-Revalidate: return cached/session data immediately while refreshing in background
  if (staleData !== undefined) {
    return staleData;
  }
  return entry!.promise as Promise<T>;
}

function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key === p || key.startsWith(p))) {
      cache.delete(key);
    }
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("pssa_swr:") && prefixes.some((p) => k.slice(9).startsWith(p))) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

function mapAppStatus(status: string): ApplicationStatus {
  switch (status) {
    case "submitted":
      return "PENDING";
    case "under_review":
      return "UNDER_REVIEW";
    case "needs_info":
      return "INFO_REQUIRED";
    case "approved":
      return "VERIFIED";
    case "rejected":
      return "REJECTED";
    default:
      return "INCOMPLETE";
  }
}

function mapDocStatus(status: string): DocumentStatus {
  if (status === "accepted") return "ACCEPTED";
  if (status === "rejected" || status === "needs_resubmission") return "REJECTED";
  return "PENDING";
}

function mapDocLabel(type: string): string {
  switch (type) {
    case "id_document":
      return "SA ID / Passport";
    case "proof_of_residence":
      return "Proof of Residence";
    case "business_registration":
      return "CIPC Business Registration";
    case "bank_evidence":
      return "Bank Account Evidence";
    case "channel_evidence":
      return "Trading Channel Evidence";
    case "references":
      return "Client References";
    default:
      return type.replace(/_/g, " ");
  }
}

function mapMemberStatus(status: string | null | undefined): MemberStatus {
  if (status === "suspended" || status === "revoked") return "SUSPENDED";
  if (!status || status === "pending") return "PROBATION";
  return "ACTIVE";
}

function mapCaseStatus(status: string): CaseStatus {
  switch (status) {
    case "under_review":
    case "awaiting_member_response":
      return "INVESTIGATING";
    case "under_appeal":
      return "ESCALATED";
    case "decided":
    case "closed":
      return "RESOLVED";
    default:
      return "OPEN";
  }
}

interface BackendAppListItem {
  id: string;
  number: string;
  status: string;
  submittedAt: string | null;
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    tradingName: string | null;
  };
  documents: { accepted: number; total: number };
}

interface BackendMemberItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tradingName: string | null;
  scope: string | null;
  memberStatus: string | null;
  createdAt: string;
  certificate: { number: string } | null;
}

interface BackendComplaintItem {
  id: string;
  referenceNumber: string;
  type: string;
  status: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  outcome: string | null;
  createdAt: string;
  member: {
    firstName: string;
    lastName: string;
    tradingName: string | null;
  } | null;
}

function mapListApplication(item: BackendAppListItem): VerificationApplication {
  const fullName = `${item.applicant.firstName} ${item.applicant.lastName}`.trim() || item.applicant.email;
  const pct =
    item.documents.total > 0 ? Math.round((item.documents.accepted / item.documents.total) * 100) : item.submittedAt ? 80 : 30;
  return {
    id: item.id,
    referenceCode: item.number,
    applicantName: fullName,
    businessName: item.applicant.tradingName ?? fullName,
    email: item.applicant.email,
    phone: "",
    city: "",
    province: "South Africa",
    primaryCategory: "Personal Shopping",
    categories: ["Personal Shopping"],
    yearsExperience: 0,
    saIdLast4: "••••",
    bio: "",
    skills: [],
    languages: [],
    serviceAreas: [],
    status: mapAppStatus(item.status),
    submittedAt: item.submittedAt,
    createdAt: item.submittedAt ?? new Date().toISOString(),
    reviewerNotes: "",
    completionPercent: pct,
    emailVerifiedAt: item.submittedAt,
    phoneVerifiedAt: item.submittedAt,
    conductAcceptedAt: item.submittedAt,
    conductVersion: null,
    documents: Array.from({ length: item.documents.total }, (_, idx) => ({
      id: `${item.id}-doc-${idx}`,
      type: "id_document",
      label: "Document",
      fileName: "",
      status: idx < item.documents.accepted ? "ACCEPTED" : "PENDING",
      verified: idx < item.documents.accepted,
      uploadedAt: "",
    })),
    channels: [],
    assessments: [],
    tutorialProgress: { completed: 0, total: 0 },
    decisions: [],
  };
}

function mapMember(item: BackendMemberItem): MemberRecord {
  const fullName = `${item.firstName} ${item.lastName}`.trim() || item.email;
  return {
    id: item.id,
    memberNumber: item.certificate?.number ?? `PSSA-${item.id.slice(-4).toUpperCase()}`,
    fullName,
    businessName: item.tradingName ?? fullName,
    email: item.email,
    city: "South Africa",
    tier: item.memberStatus === "active" ? "VERIFIED" : "ASSOCIATE",
    status: mapMemberStatus(item.memberStatus),
    categories: item.scope ? [item.scope] : ["Personal Shopping"],
    verifiedChecks: 1,
    rating: 5.0,
    joinedAt: item.createdAt.slice(0, 10),
  };
}

function mapComplaint(item: BackendComplaintItem): CaseRecord {
  const against = item.member
    ? item.member.tradingName || `${item.member.firstName} ${item.member.lastName}`.trim()
    : "Unassigned / Public Report";
  return {
    id: item.id,
    caseNumber: item.referenceNumber,
    reporterName: item.contactName ?? "Anonymous",
    reporterEmail: item.contactEmail ?? "",
    againstMember: against,
    category: item.type.replace(/_/g, " "),
    severity: item.status === "under_appeal" ? "HIGH" : "MEDIUM",
    status: mapCaseStatus(item.status),
    summary: item.description ?? "",
    resolutionNotes: item.outcome ? `Outcome: ${item.outcome.replace(/_/g, " ")}` : "",
    openedAt: item.createdAt.slice(0, 10),
  };
}

function mapOnboardingMemberToApplication(item: BackendMemberItem): VerificationApplication {
  const fullName = `${item.firstName} ${item.lastName}`.trim() || item.email;
  return {
    id: `member:${item.id}`,
    referenceCode: "ONBOARDING",
    applicantName: fullName,
    businessName: item.tradingName ?? fullName,
    email: item.email,
    phone: "",
    city: "",
    province: "South Africa",
    primaryCategory: item.scope ?? "Personal Shopping",
    categories: item.scope ? [item.scope] : ["Personal Shopping"],
    yearsExperience: 0,
    saIdLast4: "••••",
    bio: item.scope ?? "",
    skills: [],
    languages: [],
    serviceAreas: [],
    status: "PENDING",
    submittedAt: item.createdAt,
    createdAt: item.createdAt,
    reviewerNotes: "Member is currently undergoing onboarding verification (application not yet submitted).",
    completionPercent: 25,
    emailVerifiedAt: item.createdAt,
    phoneVerifiedAt: null,
    conductAcceptedAt: null,
    conductVersion: null,
    documents: [],
    channels: [],
    assessments: [],
    tutorialProgress: { completed: 0, total: 1 },
    decisions: [],
  };
}

function mergeOnboardingMembers(apps: VerificationApplication[], members: BackendMemberItem[]): VerificationApplication[] {
  const appEmails = new Set(apps.map((a) => a.email.toLowerCase()));
  const onboarding = members
    .filter((m) => (!m.memberStatus || m.memberStatus === "pending") && !appEmails.has(m.email.toLowerCase()))
    .map(mapOnboardingMemberToApplication);
  return [...apps, ...onboarding];
}

export const adminApi = {
  isMockMode: () => false,
  clearCache: () => {
    cache.clear();
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith("pssa_swr:")) sessionStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  },
  prefetchCore: () => {
    void Promise.allSettled([
      adminApi.getOverview(),
      adminApi.listApplications(),
      adminApi.listMembers(),
      adminApi.listCases(),
      adminApi.listTutorials(),
    ]);
  },

  async getOverview() {
    return cached("overview", async () => {
      const res = await api<{
        applications: BackendAppListItem[];
        members: BackendMemberItem[];
        cases: BackendComplaintItem[];
        listings: ListingRecord[];
      }>("/admin/overview");
      const mappedApps = res.applications.map(mapListApplication);
      return {
        applications: mergeOnboardingMembers(mappedApps, res.members),
        members: res.members.map(mapMember),
        cases: res.cases.map(mapComplaint),
        listings: res.listings ?? [],
      };
    });
  },

  async listApplications(): Promise<VerificationApplication[]> {
    return cached("applications", async () => {
      const [appsRes, membersRes] = await Promise.all([
        api<{ items: BackendAppListItem[] }>("/admin/applications?pageSize=50"),
        api<{ items: BackendMemberItem[] }>("/admin/members?pageSize=50"),
      ]);
      return mergeOnboardingMembers(appsRes.items.map(mapListApplication), membersRes.items);
    });
  },

  async getApplication(id: string): Promise<{ profile: VerificationApplication | null }> {
    return cached(`application:${id}`, async () => {
      if (id.startsWith("member:")) {
        const memberId = id.slice("member:".length);
        const res = await api<{
          member: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            tradingName: string | null;
            scope: string | null;
            memberStatus: string | null;
            city: string | null;
            createdAt: string;
            channels: { id: string; kind: string; value: string; status: string }[];
            history: {
              id: string;
              to: string;
              reason: string;
              at: string;
              actor: { firstName: string; lastName: string; email: string } | null;
            }[];
          };
        }>(`/admin/members/${memberId}`);
        const m = res.member;
        const fullName = `${m.firstName} ${m.lastName}`.trim() || m.email;
        return {
          profile: {
            id,
            referenceCode: "ONBOARDING",
            applicantName: fullName,
            businessName: m.tradingName ?? fullName,
            email: m.email,
            phone: m.phone ?? "",
            city: m.city ?? "",
            province: "South Africa",
            primaryCategory: m.scope ?? "Personal Shopping",
            categories: m.scope ? [m.scope] : ["Personal Shopping"],
            yearsExperience: 0,
            saIdLast4: "••••",
            bio: m.scope ?? "Member is currently completing onboarding verification.",
            skills: [],
            languages: [],
            serviceAreas: m.city ? [m.city] : [],
            status: m.memberStatus === "active" ? "VERIFIED" : m.memberStatus === "suspended" ? "SUSPENDED" : "PENDING",
            submittedAt: m.createdAt,
            createdAt: m.createdAt,
            reviewerNotes: "Onboarding in progress — awaiting final application submission.",
            completionPercent: 25,
            emailVerifiedAt: m.createdAt,
            phoneVerifiedAt: m.phone ? m.createdAt : null,
            conductAcceptedAt: null,
            conductVersion: null,
            documents: [],
            channels: m.channels.map((ch) => ({
              id: ch.id,
              platform: ch.kind,
              handle: ch.value,
              confirmed: ch.status === "verified" || ch.status === "confirmed",
            })),
            assessments: [],
            tutorialProgress: { completed: 0, total: 1 },
            decisions: m.history.map((h) => ({
              id: h.id,
              decision: h.to === "active" ? "APPROVED" : h.to === "suspended" ? "SUSPENDED" : "UNDER_REVIEW",
              reason: h.reason,
              reviewer: h.actor ? `${h.actor.firstName} ${h.actor.lastName}`.trim() || h.actor.email : "Admin",
              createdAt: h.at,
            })),
          },
        };
      }
      const [{ application, activation }, tutorialRes, examRes] = await Promise.all([
      api<{
        application: {
          id: string;
          number: string;
          status: string;
          submittedAt: string | null;
          agreementAcceptedAt: string | null;
          agreementVersion: string | null;
          createdAt: string;
          user: {
            email: string;
            memberProfile: {
              firstName: string;
              lastName: string;
              phone: string | null;
              tradingName: string | null;
              scope: string | null;
              city: string | null;
              channels?: { id: string; kind: string; value: string; status: string }[];
            } | null;
            documents: {
              id: string;
              type: string;
              originalName: string;
              status: string;
              reviewerNote: string | null;
              createdAt: string;
            }[];
          };
          reviews: {
            id: string;
            decision: string;
            reason: string | null;
            createdAt: string;
            reviewer: { firstName: string; lastName: string; email: string };
          }[];
        };
        activation: { ready: boolean; gates: { id: string; passed: boolean }[] };
      }>(`/admin/applications/${id}`),
      api<{ tutorial: { completed?: boolean; watchedCount?: number; totalCount?: number } | null }>(
        `/admin/applications/${id}/tutorial`,
      ).catch(() => ({ tutorial: null })),
      api<{
        exam: {
          attempts?: {
            id: string;
            startedAt: string;
            submittedAt: string | null;
            score: number;
            total?: number;
            passed: boolean;
            criticalFailed?: boolean;
          }[];
        } | null;
      }>(`/admin/applications/${id}/exam`).catch(() => ({ exam: null })),
    ]);

    const p = application.user.memberProfile;
    const fullName = p ? `${p.firstName} ${p.lastName}`.trim() : application.user.email;
    const docs = application.user.documents.map((d) => ({
      id: d.id,
      type: d.type as ApplicationDocType,
      label: mapDocLabel(d.type),
      fileName: d.originalName,
      status: mapDocStatus(d.status),
      verified: d.status === "accepted",
      reviewerNote: d.reviewerNote ?? undefined,
      uploadedAt: d.createdAt.slice(0, 10),
    }));
    const passedGates = activation.gates.filter((g) => g.passed).length;
    const completionPercent =
      activation.gates.length > 0 ? Math.round((passedGates / activation.gates.length) * 100) : 0;

    return {
      profile: {
        id: application.id,
        referenceCode: application.number,
        applicantName: fullName,
        businessName: p?.tradingName ?? fullName,
        email: application.user.email,
        phone: p?.phone ?? "",
        city: p?.city ?? "",
        province: "South Africa",
        primaryCategory: p?.scope ?? "Personal Shopping",
        categories: p?.scope ? [p.scope] : ["Personal Shopping"],
        yearsExperience: 0,
        saIdLast4: "••••",
        bio: p?.scope ?? "",
        skills: [],
        languages: [],
        serviceAreas: p?.city ? [p.city] : [],
        status: mapAppStatus(application.status),
        submittedAt: application.submittedAt,
        createdAt: application.createdAt,
        reviewerNotes: "",
        completionPercent,
        emailVerifiedAt: application.submittedAt,
        phoneVerifiedAt: p?.phone ? application.submittedAt : null,
        conductAcceptedAt: application.agreementAcceptedAt,
        conductVersion: application.agreementVersion,
        documents: docs,
        channels: (p?.channels ?? []).map((ch) => ({
          id: ch.id,
          platform: ch.kind,
          handle: ch.value,
          confirmed: ch.status === "confirmed",
        })),
        assessments: (examRes.exam?.attempts ?? []).map((a) => ({
          id: a.id,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          score: a.score ?? 0,
          total: a.total ?? 10,
          passed: Boolean(a.passed),
          criticalFailed: a.criticalFailed,
        })),
        tutorialProgress: {
          completed: tutorialRes.tutorial?.watchedCount ?? (tutorialRes.tutorial?.completed ? 1 : 0),
          total: tutorialRes.tutorial?.totalCount ?? 1,
        },
        decisions: application.reviews.map((r) => ({
          id: r.id,
          decision: r.decision.toUpperCase() as VerificationDecision,
          reason: r.reason ?? undefined,
          reviewer: `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim() || r.reviewer.email,
          createdAt: r.createdAt,
        })),
      },
    };
    });
  },

  async recordVerificationDecision(
    id: string,
    decision: VerificationDecision,
    reason?: string,
    checks?: { identity: boolean; contact: boolean; qualifications: boolean; conduct: boolean; method?: string },
  ): Promise<VerificationApplication> {
    void checks;
    if (id.startsWith("member:")) {
      const memberId = id.slice("member:".length);
      const status =
        decision === "APPROVED" || decision === "REINSTATED"
          ? "active"
          : decision === "REJECTED" || decision === "SUSPENDED"
            ? "suspended"
            : "pending";
      await api(`/admin/members/${memberId}/status`, {
        method: "POST",
        body: {
          status,
          reason: reason && reason.trim().length >= 10 ? reason.trim() : "Admin verification decision recorded.",
          conflictDeclared: true,
        },
      });
      invalidate("overview", "applications", `application:${id}`, "members", "audit");
      const res = await this.getApplication(id);
      return res.profile!;
    }
    const decisionMap: Record<VerificationDecision, "approved" | "rejected" | "needs_info"> = {
      APPROVED: "approved",
      REINSTATED: "approved",
      REJECTED: "rejected",
      SUSPENDED: "rejected",
      INFO_REQUIRED: "needs_info",
      UNDER_REVIEW: "needs_info",
    };
    await api(`/admin/applications/${id}/decision`, {
      method: "POST",
      body: {
        decision: decisionMap[decision],
        reason: reason && reason.trim().length >= 10 ? reason.trim() : "Admin verification decision recorded.",
        conflictDeclared: true,
      },
    });
    invalidate("overview", "applications", `application:${id}`, "members", "audit");
    const res = await this.getApplication(id);
    return res.profile!;
  },

  async reviewApplicationDoc(
    appId: string,
    docId: string,
    status: DocumentStatus,
    note?: string,
  ): Promise<VerificationApplication> {
    const reviewStatus = status === "ACCEPTED" ? "accepted" : status === "REJECTED" ? "needs_resubmission" : "under_review";
    const trimmedNote = note?.trim();
    const reviewerNote =
      reviewStatus === "needs_resubmission"
        ? trimmedNote && trimmedNote.length >= 10
          ? trimmedNote
          : "Document needs resubmission — please upload a clearer copy."
        : trimmedNote || undefined;
    await api(`/admin/documents/${docId}`, {
      method: "PATCH",
      body: {
        reviewStatus,
        ...(reviewerNote ? { reviewerNote } : {}),
      },
    });
    invalidate("overview", "applications", `application:${appId}`);
    const res = await this.getApplication(appId);
    return res.profile!;
  },

  async allowExamRetake(appId: string, attemptId: string, reason: string): Promise<VerificationApplication> {
    await api(`/exam/attempts/${attemptId}/allow-retake`, {
      method: "POST",
      body: { reason, conflictDeclared: true },
    });
    invalidate(`application:${appId}`, "audit");
    const res = await this.getApplication(appId);
    return res.profile!;
  },

  async toggleApplicationChannel(appId: string, channelId: string): Promise<void> {
    await api(`/admin/applications/${appId}/channels/${channelId}`, { method: "PATCH" });
    invalidate(`application:${appId}`, "overview");
    if (appId.startsWith("member:")) {
      invalidate(`member:${appId.slice("member:".length)}`);
    }
  },

  async listMembers(): Promise<MemberRecord[]> {
    return cached("members", async () => {
      const res = await api<{ items: BackendMemberItem[] }>("/admin/members?pageSize=50");
      return res.items.map(mapMember);
    });
  },

  async getMemberDetail(id: string): Promise<MemberDetailRecord | null> {
    return cached(`member:${id}`, async () => {
      const res = await api<{ member: MemberDetailRecord }>(`/admin/members/${id}`);
      return res.member ?? null;
    });
  },

  async updateMemberStatus(id: string, status: MemberStatus): Promise<void> {
    const backendStatus = status === "SUSPENDED" ? "suspended" : status === "PROBATION" ? "pending" : "active";
    await api(`/admin/members/${id}/status`, {
      method: "POST",
      body: {
        status: backendStatus,
        reason: `Member standing updated to ${backendStatus} via admin dashboard.`,
        conflictDeclared: true,
      },
    });
    invalidate("overview", "members", `member:${id}`, "audit");
  },

  async listListings(): Promise<ListingRecord[]> {
    return [];
  },

  async updateListingStatus(id: string, status: ListingStatus): Promise<void> {
    void id;
    void status;
    // Out of Phase 1 backend scope.
  },

  async listCases(): Promise<CaseRecord[]> {
    return cached("cases", async () => {
      const res = await api<{ items: BackendComplaintItem[] }>("/admin/complaints?pageSize=50");
      return res.items.map(mapComplaint);
    });
  },

  async getCaseDetail(id: string): Promise<CaseDetailRecord> {
    const res = await api<{ complaint: CaseDetailRecord }>(`/admin/complaints/${id}`);
    return res.complaint;
  },

  async decideCase(id: string, outcome: CaseOutcome, reasons: string): Promise<void> {
    await api(`/admin/complaints/${id}/decision`, {
      method: "POST",
      body: { outcome, reasons: reasons.trim(), conflictDeclared: true },
    });
    invalidate("overview", "cases", "members", "audit");
  },

  async decideCaseAppeal(id: string, decision: string, reasons: string): Promise<void> {
    await api(`/admin/complaints/${id}/appeal-decision`, {
      method: "POST",
      body: { decision: decision.trim(), reasons: reasons.trim(), conflictDeclared: true },
    });
    invalidate("overview", "cases", "members", "audit");
  },

  async updateCase(id: string, status: CaseStatus, resolutionNotes: string): Promise<void> {
    const trimmed = resolutionNotes.trim();
    if (status === "RESOLVED") {
      await api(`/admin/complaints/${id}/decision`, {
        method: "POST",
        body: {
          outcome: "no_breach",
          reasons: trimmed.length >= 10 ? trimmed : "Case resolved after admin compliance review.",
          conflictDeclared: true,
        },
      });
      invalidate("overview", "cases", "audit");
      return;
    }
    const statusMap: Record<Exclude<CaseStatus, "RESOLVED">, string> = {
      OPEN: "received",
      INVESTIGATING: "under_review",
      ESCALATED: "under_appeal",
    };
    await api(`/admin/complaints/${id}`, {
      method: "PATCH",
      body: {
        status: statusMap[status],
        ...(trimmed ? { internalNote: trimmed } : {}),
      },
    });
    invalidate("overview", "cases", "audit");
  },

  async listTutorials(): Promise<TutorialRecord[]> {
    return cached("tutorials", async () => {
      const res = await api<{ tutorials: TutorialRecord[] }>("/tutorials");
      return res.tutorials;
    });
  },

  async uploadTutorial(input: {
    title: string;
    description?: string;
    version?: number;
    file: File;
    durationSeconds?: number;
  }): Promise<TutorialRecord> {
    const form = new FormData();
    form.append("title", input.title);
    if (input.description?.trim()) form.append("description", input.description.trim());
    if (input.version !== undefined) form.append("version", String(input.version));
    if (input.durationSeconds) form.append("durationSeconds", String(input.durationSeconds));
    form.append("file", input.file);
    const res = await api<{ tutorial: TutorialRecord }>("/tutorials", { method: "POST", form });
    invalidate("tutorials");
    return res.tutorial;
  },

  async updateTutorial(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      version?: number;
      durationSeconds?: number | null;
      isActive?: boolean;
    },
  ): Promise<TutorialRecord> {
    const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}`, { method: "PATCH", body: patch });
    invalidate("tutorials");
    return res.tutorial;
  },

  async activateTutorial(id: string): Promise<TutorialRecord> {
    const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}/activate`, { method: "POST" });
    invalidate("tutorials");
    return res.tutorial;
  },

  async listExamQuestions(): Promise<ExamQuestionRecord[]> {
    return cached("examQuestions", async () => {
      const res = await api<{ questions: ExamQuestionRecord[] }>("/exam/questions");
      return res.questions;
    });
  },

  async createExamQuestion(
    input: Omit<ExamQuestionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ExamQuestionRecord> {
    const res = await api<{ question: ExamQuestionRecord }>("/exam/questions", { method: "POST", body: input });
    invalidate("examQuestions");
    return res.question;
  },

  async updateExamQuestion(
    id: string,
    patch: Partial<Omit<ExamQuestionRecord, "id" | "createdAt" | "updatedAt">>,
  ): Promise<ExamQuestionRecord> {
    const res = await api<{ question: ExamQuestionRecord }>(`/exam/questions/${id}`, {
      method: "PATCH",
      body: patch,
    });
    invalidate("examQuestions");
    return res.question;
  },

  async deleteExamQuestion(id: string): Promise<void> {
    await api(`/exam/questions/${id}`, { method: "DELETE" });
    invalidate("examQuestions");
  },

  async listAudit(): Promise<AuditEntry[]> {
    return cached("audit", async () => {
      const res = await api<{
        items: {
          id: string;
          action: string;
          entityType: string;
          entityId: string;
          at?: string;
          createdAt?: string;
          reason?: string | null;
          actor: { firstName: string | null; lastName: string | null; email: string } | null;
        }[];
      }>("/admin/audit?pageSize=50");

      const mapCategory = (entityType: string, action: string): AuditEntry["category"] => {
        const key = `${entityType} ${action}`.toLowerCase();
        if (key.includes("tutorial")) return "TUTORIAL";
        if (key.includes("exam") || key.includes("practical") || key.includes("assessment")) return "ASSESSMENT";
        if (key.includes("case") || key.includes("complaint")) return "CASE";
        if (key.includes("listing")) return "LISTING";
        if (key.includes("category")) return "CATEGORY";
        if (key.includes("setting")) return "SETTINGS";
        if (key.includes("member") || key.includes("renewal")) return "MEMBER";
        return "VERIFICATION";
      };

      return res.items.map((item) => {
        const ts = item.at ?? item.createdAt ?? "";
        const actorName = item.actor
          ? [item.actor.firstName, item.actor.lastName].filter(Boolean).join(" ").trim() || item.actor.email
          : "System";
        const target = item.reason
          ? `${item.entityType} (${item.entityId}) — ${item.reason}`
          : `${item.entityType} (${item.entityId})`;
        return {
          id: item.id,
          actor: actorName,
          action: item.action,
          target,
          category: mapCategory(item.entityType, item.action),
          timestamp: ts ? ts.slice(0, 16).replace("T", " ") : "—",
        };
      });
    });
  },

  async listNotifications(): Promise<NotificationItem[]> {
    return cached("notifications", async () => {
      const res = await api<{
        notifications: {
          id: string;
          title: string;
          body: string;
          type: "INFO" | "WARNING" | "SUCCESS";
          link: string | null;
          read: boolean;
          createdAt: string;
        }[];
      }>("/admin/notifications");
      return res.notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.slice(0, 16).replace("T", " "),
      }));
    });
  },

  async markAllNotificationsRead(): Promise<void> {
    await api("/admin/notifications/read-all", { method: "POST" });
    invalidate("notifications");
  },

  async listRenewals(): Promise<RenewalRecord[]> {
    return cached("renewals", async () => {
      const res = await api<{ items: RenewalRecord[] }>("/admin/renewals?pageSize=50");
      return res.items;
    });
  },

  async getRenewalDetail(id: string): Promise<{ renewal: RenewalRecord; checklist: RenewalChecklistItem[] }> {
    return api<{ renewal: RenewalRecord; checklist: RenewalChecklistItem[] }>(`/admin/renewals/${id}`);
  },

  async decideRenewal(
    id: string,
    decision: "approved" | "rejected" | "needs_info",
    reason: string,
  ): Promise<void> {
    await api(`/admin/renewals/${id}/decision`, {
      method: "POST",
      body: { decision, reason: reason.trim(), conflictDeclared: true },
    });
    invalidate("renewals", "members", "overview", "audit");
  },

  async getSettings(): Promise<AdminSettings> {
    return api<AdminSettings>("/admin/settings");
  },

  async saveSettings(next: AdminSettings): Promise<AdminSettings> {
    const saved = await api<AdminSettings>("/admin/settings", {
      method: "PUT",
      body: next,
    });
    invalidate("audit");
    return saved;
  },

  async listExamDocuments(): Promise<ExamDocumentRecord[]> {
    return cached("examDocuments", async () => {
      const res = await api<{
        assets: (ExamDocumentRecord & { kind: string })[];
      }>("/admin/practical-assessment/assets");
      return res.assets.filter((a) => a.kind === "assignment_brief");
    });
  },

  async uploadExamDocument(input: { title?: string; file: File; activate?: boolean }): Promise<ExamDocumentRecord> {
    const form = new FormData();
    form.append("file", input.file);
    if (input.title?.trim()) form.append("title", input.title.trim());
    form.append("activate", String(input.activate ?? true));
    const res = await api<{ asset: ExamDocumentRecord }>("/admin/practical-assessment/assets/assignment_brief/upload", {
      method: "POST",
      form,
    });
    invalidate("examDocuments", "audit");
    return res.asset;
  },

  async activateExamDocument(id: string): Promise<ExamDocumentRecord> {
    const res = await api<{ asset: ExamDocumentRecord }>(
      `/admin/practical-assessment/assets/${encodeURIComponent(id)}/activate`,
      { method: "POST", body: {} },
    );
    invalidate("examDocuments", "audit");
    return res.asset;
  },

  async deactivateExamDocument(id: string): Promise<ExamDocumentRecord> {
    const res = await api<{ asset: ExamDocumentRecord }>(
      `/admin/practical-assessment/assets/${encodeURIComponent(id)}/deactivate`,
      { method: "POST", body: {} },
    );
    invalidate("examDocuments", "audit");
    return res.asset;
  },
};
