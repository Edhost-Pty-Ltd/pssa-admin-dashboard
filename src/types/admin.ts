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

export type TrialStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED";
export type DocumentStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type MemberStatus = "ACTIVE" | "SUSPENDED" | "PROBATION";
export type MemberTier = "FOUNDING" | "VERIFIED" | "ASSOCIATE";
export type CustomerStatus = "ACTIVE" | "SUSPENDED";
export type ListingStatus = "ACTIVE" | "PENDING" | "PAUSED" | "FLAGGED";
export type CaseStatus = "OPEN" | "INVESTIGATING" | "ESCALATED" | "RESOLVED";

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
}

export interface TrialVideo {
  id: string;
  status: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED";
  durationSeconds: number;
  sizeBytes: number;
  createdAt: string;
  reviewedAt?: string;
  reviewer?: string;
  reviewerNote?: string;
  scenarioPrompt: string;
}

export interface ProviderTrialData {
  status: TrialStatus;
  lessonsCompleted: number;
  lessonsTotal: number;
  conditionsAcceptedAt: string | null;
  scenarioPrompt: string;
  videos: TrialVideo[];
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
  trial: ProviderTrialData;
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

export interface CustomerMemberRecord {
  id: string;
  customerCode: string;
  fullName: string;
  email: string;
  city: string;
  policyAccepted: boolean;
  status: CustomerStatus;
  shopperLookups: number;
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
  category: string;
  duration: string;
  audience: "ALL_SHOPPERS" | "NEW_APPLICANTS" | "ADMIN";
  published: boolean;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  category: "VERIFICATION" | "CATEGORY" | "MEMBER" | "CUSTOMER" | "CASE" | "LISTING" | "SETTINGS";
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "INFO" | "WARNING" | "SUCCESS";
  read: boolean;
  createdAt: string;
}

export interface AdminSettings {
  associationName: string;
  supportEmail: string;
  annualMembershipFeeZar: number;
  verificationSlaHours: number;
  autoPublishApprovedListings: boolean;
  requireIdVerification: boolean;
}
