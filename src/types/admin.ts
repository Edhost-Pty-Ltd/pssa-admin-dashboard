export type ApplicationStatus =
  | "INCOMPLETE"
  | "PENDING"
  | "UNDER_REVIEW"
  | "INFO_REQUIRED"
  | "VERIFIED"
  | "SUSPENDED"
  | "REJECTED";

export type VerificationDecision =
  | "UNDER_REVIEW"
  | "INFO_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "REINSTATED";

export type DocumentStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type MemberStatus = "ACTIVE" | "SUSPENDED" | "PROBATION";
export type MemberTier = "FOUNDING" | "VERIFIED" | "ASSOCIATE";
export type ListingStatus = "ACTIVE" | "PENDING" | "PAUSED" | "FLAGGED";
export type CaseStatus = "OPEN" | "INVESTIGATING" | "ESCALATED" | "RESOLVED";
export type CaseOutcome = "no_breach" | "corrective_action" | "suspension" | "revocation";

export interface CaseDetailRecord {
  id: string;
  referenceNumber: string;
  type: string;
  status: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  outcome: CaseOutcome | null;
  reasons: string | null;
  evidence: { id: string; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
  responses: {
    id: string;
    body: string;
    createdAt: string;
    member: { firstName: string; lastName: string; tradingName: string | null } | null;
  }[];
  appeals: {
    id: string;
    reason: string;
    lodgedAt: string;
    decidedAt: string | null;
    decision: string | null;
    reasons: string | null;
  }[];
}

export type ApplicationDocType =
  | "id_document"
  | "proof_of_residence"
  | "business_registration"
  | "bank_evidence"
  | "channel_evidence"
  | "references";

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  examples: string[];
  sortOrder: number;
  isActive: boolean;
  providerCount: number;
  listingCount: number;
}

export interface ApplicationDocument {
  id: string;
  type: ApplicationDocType;
  label: string;
  fileName: string;
  status: DocumentStatus;
  verified: boolean;
  reviewerNote?: string;
  sizeBytes?: number;
  uploadedAt: string;
}

export interface VerificationChannel {
  id: string;
  platform: string;
  handle: string;
  confirmed: boolean;
}

export interface AssessmentAttempt {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  total: number;
  passed: boolean;
  criticalFailed?: boolean;
  retakeUnlocked?: boolean;
}

export interface TutorialProgressSummary {
  completed: number;
  total: number;
}

export interface DecisionRecord {
  id: string;
  decision: VerificationDecision;
  reason?: string;
  reviewer: string;
  createdAt: string;
}

export interface VerificationApplication {
  id: string;
  referenceCode: string;
  applicantName: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  primaryCategory: string;
  categories: string[];
  yearsExperience: number;
  saIdLast4: string;
  bio: string;
  skills: string[];
  languages: string[];
  serviceAreas: string[];
  status: ApplicationStatus;
  statusFeedback?: string;
  certificateNumber?: string;
  verificationExpiresAt?: string;
  submittedAt: string | null;
  createdAt: string;
  reviewerNotes: string;
  completionPercent: number;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  conductAcceptedAt: string | null;
  conductVersion: string | null;
  documents: ApplicationDocument[];
  channels: VerificationChannel[];
  assessments: AssessmentAttempt[];
  tutorialProgress: TutorialProgressSummary;
  decisions: DecisionRecord[];
}

export interface MemberRecord {
  id: string;
  memberNumber: string;
  fullName: string;
  businessName: string;
  email: string;
  city: string;
  tier: MemberTier;
  status: MemberStatus;
  categories: string[];
  verifiedChecks: number;
  rating: number;
  joinedAt: string;
}

export interface ListingRecord {
  id: string;
  title: string;
  shopperName: string;
  categoryId: string;
  categoryName: string;
  city: string;
  specialtySummary: string;
  status: ListingStatus;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  reporterName: string;
  reporterEmail: string;
  againstMember: string;
  reportedChannel?: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: CaseStatus;
  summary: string;
  resolutionNotes: string;
  openedAt: string;
}

export interface TutorialRecord {
  id: string;
  title: string;
  description: string | null;
  version: number;
  durationSeconds: number | null;
  isActive: boolean;
  storagePath: string;
  uploadedById: string;
  createdAt: string;
  /** Local object URL used in mock mode for in-browser video preview. */
  previewUrl?: string;
}

export interface ExamOption {
  id: string;
  label: string;
}

export interface ExamQuestionRecord {
  id: string;
  topic: string;
  prompt: string;
  options: ExamOption[];
  correctOptionId: string;
  isCritical: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  category: "VERIFICATION" | "CATEGORY" | "MEMBER" | "CASE" | "LISTING" | "TUTORIAL" | "ASSESSMENT" | "SETTINGS";
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "INFO" | "WARNING" | "SUCCESS";
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface MemberDetailRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  tradingName: string | null;
  scope: string | null;
  memberStatus: string | null;
  physicalAddress: string | null;
  city: string | null;
  identityType: string | null;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  certificate: {
    id: string;
    number: string;
    issuedAt: string;
    validFrom: string;
    validUntil: string;
    scope: string | null;
    qrTargetUrl: string;
    status: string;
  } | null;
  application: {
    id: string;
    number: string;
    status: string;
    submittedAt: string | null;
  } | null;
  channels: {
    id: string;
    kind: string;
    value: string;
    status: string;
  }[];
  history: {
    id: string;
    from: string | null;
    to: string;
    reason: string;
    at: string;
    actor: { firstName: string; lastName: string; email: string } | null;
  }[];
}

export interface AdminSettings {
  associationName: string;
  supportEmail: string;
  annualMembershipFeeZar: number;
  verificationSlaHours: number;
  autoPublishApprovedListings: boolean;
  requireIdVerification: boolean;
}
