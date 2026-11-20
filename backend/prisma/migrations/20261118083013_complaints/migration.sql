-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('misconduct', 'impersonation', 'badge_misuse');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('received', 'under_review', 'awaiting_member_response', 'decided', 'under_appeal');

-- CreateEnum
CREATE TYPE "ComplaintOutcome" AS ENUM ('no_breach', 'corrective_action', 'suspension', 'revocation');

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "reference_number" TEXT,
    "member_profile_id" TEXT,
    "type" "ComplaintType" NOT NULL,
    "description" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'received',
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "consent_at" TIMESTAMP(3),
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "acknowledged_at" TIMESTAMP(3),
    "member_response_due_at" TIMESTAMP(3),
    "decision_due_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "appeal_deadline" TIMESTAMP(3),
    "outcome" "ComplaintOutcome",
    "reasons" TEXT,
    "conflict_declared" BOOLEAN,
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_evidence" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_responses" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_appeals" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "lodged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decision" TEXT,
    "reasons" TEXT,
    "conflict_declared" BOOLEAN,
    "reviewer_id" TEXT,

    CONSTRAINT "complaint_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "complaints_reference_number_key" ON "complaints"("reference_number");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaint_evidence_complaint_id_idx" ON "complaint_evidence"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_responses_complaint_id_idx" ON "complaint_responses"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_appeals_complaint_id_idx" ON "complaint_appeals"("complaint_id");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_evidence" ADD CONSTRAINT "complaint_evidence_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_responses" ADD CONSTRAINT "complaint_responses_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_responses" ADD CONSTRAINT "complaint_responses_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_appeals" ADD CONSTRAINT "complaint_appeals_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_appeals" ADD CONSTRAINT "complaint_appeals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
