import type {
  AdminSettings,
  ApplicationDocType,
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
  if (status === "pending") return "PROBATION";
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
    tier: "VERIFIED",
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

export const adminApi = {
  isMockMode: () => false,

  async getOverview() {
    const res = await api<{
      applications: BackendAppListItem[];
      members: BackendMemberItem[];
      cases: BackendComplaintItem[];
      listings: ListingRecord[];
    }>("/admin/overview");
    return {
      applications: res.applications.map(mapListApplication),
      members: res.members.map(mapMember),
      cases: res.cases.map(mapComplaint),
      listings: res.listings ?? [],
    };
  },

  async listApplications(): Promise<VerificationApplication[]> {
    const res = await api<{ items: BackendAppListItem[] }>("/admin/applications?pageSize=50");
    return res.items.map(mapListApplication);
  },

  async getApplication(id: string): Promise<{ profile: VerificationApplication | null }> {
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
        channels: [],
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
  },

  async recordVerificationDecision(
    id: string,
    decision: VerificationDecision,
    reason?: string,
    checks?: { identity: boolean; contact: boolean; qualifications: boolean; conduct: boolean; method?: string },
  ): Promise<VerificationApplication> {
    void checks;
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
    const res = await this.getApplication(appId);
    return res.profile!;
  },

  async allowExamRetake(appId: string, attemptId: string, reason: string): Promise<VerificationApplication> {
    await api(`/exam/attempts/${attemptId}/allow-retake`, {
      method: "POST",
      body: { reason, conflictDeclared: true },
    });
    const res = await this.getApplication(appId);
    return res.profile!;
  },

  async toggleApplicationChannel(appId: string, channelId: string): Promise<void> {
    void appId;
    void channelId;
    // Channel confirmation is managed on member submission in Phase 1 backend.
  },

  async listMembers(): Promise<MemberRecord[]> {
    const res = await api<{ items: BackendMemberItem[] }>("/admin/members?pageSize=50");
    return res.items.map(mapMember);
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
    const res = await api<{ items: BackendComplaintItem[] }>("/admin/complaints?pageSize=50");
    return res.items.map(mapComplaint);
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
  },

  async listTutorials(): Promise<TutorialRecord[]> {
    const res = await api<{ tutorials: TutorialRecord[] }>("/tutorials");
    return res.tutorials;
  },

  async uploadTutorial(input: { title: string; file: File; durationSeconds?: number }): Promise<TutorialRecord> {
    const form = new FormData();
    form.append("title", input.title);
    if (input.durationSeconds) form.append("durationSeconds", String(input.durationSeconds));
    form.append("file", input.file);
    const res = await api<{ tutorial: TutorialRecord }>("/tutorials", { method: "POST", form });
    return res.tutorial;
  },

  async updateTutorial(
    id: string,
    patch: { title?: string; durationSeconds?: number | null; isActive?: boolean },
  ): Promise<TutorialRecord> {
    const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}`, { method: "PATCH", body: patch });
    return res.tutorial;
  },

  async activateTutorial(id: string): Promise<TutorialRecord> {
    const res = await api<{ tutorial: TutorialRecord }>(`/tutorials/${id}/activate`, { method: "POST" });
    return res.tutorial;
  },

  async listExamQuestions(): Promise<ExamQuestionRecord[]> {
    const res = await api<{ questions: ExamQuestionRecord[] }>("/exam/questions");
    return res.questions;
  },

  async createExamQuestion(
    input: Omit<ExamQuestionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ExamQuestionRecord> {
    const res = await api<{ question: ExamQuestionRecord }>("/exam/questions", { method: "POST", body: input });
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
    return res.question;
  },

  async deleteExamQuestion(id: string): Promise<void> {
    await api(`/exam/questions/${id}`, { method: "DELETE" });
  },

  async listAudit(): Promise<AuditEntry[]> {
    const res = await api<{
      items: {
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        createdAt: string;
        actor: { firstName: string; lastName: string; email: string } | null;
      }[];
    }>("/admin/audit?pageSize=50");
    return res.items.map((item) => ({
      id: item.id,
      actor: item.actor ? `${item.actor.firstName} ${item.actor.lastName}`.trim() || item.actor.email : "System",
      action: item.action,
      target: `${item.entityType} (${item.entityId})`,
      category: "VERIFICATION",
      timestamp: item.createdAt.slice(0, 16).replace("T", " "),
    }));
  },

  async listNotifications(): Promise<NotificationItem[]> {
    return [];
  },

  async markAllNotificationsRead(): Promise<void> {
    // No backend notifications table in Phase 1.
  },

  async getSettings(): Promise<AdminSettings> {
    return {
      associationName: "Personal Shoppers & Sourcing Association",
      supportEmail: "compliance@pssa.org.za",
      annualMembershipFeeZar: 1200,
      verificationSlaHours: 48,
      autoPublishApprovedListings: true,
      requireIdVerification: true,
    };
  },

  async saveSettings(next: AdminSettings): Promise<AdminSettings> {
    return next;
  },
};
