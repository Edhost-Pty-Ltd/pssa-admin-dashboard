-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('draft', 'submitted', 'needs_info', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "renewals" (
    "id" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "status" "RenewalStatus" NOT NULL DEFAULT 'draft',
    "window_opens_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "declaration_accepted_at" TIMESTAMP(3),
    "declaration_version" TEXT,
    "declaration_statements" TEXT,
    "decision_reason" TEXT,
    "conflict_declared" BOOLEAN,
    "reviewer_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewals_member_profile_id_status_idx" ON "renewals"("member_profile_id", "status");

-- AddForeignKey
ALTER TABLE "renewals" ADD CONSTRAINT "renewals_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewals" ADD CONSTRAINT "renewals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
