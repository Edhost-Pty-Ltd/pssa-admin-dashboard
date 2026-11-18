export type ApplicationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "INFO_REQUESTED";
export type MemberStatus = "ACTIVE" | "SUSPENDED" | "PROBATION";
export type MemberTier = "FOUNDING" | "VERIFIED" | "ASSOCIATE";
export type ListingStatus = "ACTIVE" | "PENDING" | "PAUSED" | "FLAGGED";
export type BookingStatus = "REQUESTED" | "IN_PROGRESS" | "DELIVERED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
export type CaseStatus = "OPEN" | "INVESTIGATING" | "ESCALATED" | "RESOLVED";

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
  label: string;
  fileName: string;
  verified: boolean;
  uploadedAt: string;
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
  status: ApplicationStatus;
  submittedAt: string;
  reviewerNotes: string;
  documents: ApplicationDocument[];
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
  completedRuns: number;
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
  baseFeeZar: number;
  turnaround: string;
  status: ListingStatus;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  reference: string;
  clientName: string;
  shopperName: string;
  categoryName: string;
  city: string;
  estimatedBudgetZar: number;
  serviceFeeZar: number;
  status: BookingStatus;
  scheduledFor: string;
  notes: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  reporterName: string;
  reporterEmail: string;
  againstMember: string;
  bookingReference?: string;
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
  category: "VERIFICATION" | "CATEGORY" | "MEMBER" | "CASE" | "LISTING" | "SETTINGS";
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
