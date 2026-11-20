-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('sa_id', 'passport');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('entrance', 'refresher');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('active', 'expired', 'revoked', 'resigned');

-- AlterTable
ALTER TABLE "member_profiles" ADD COLUMN     "identity_type" "IdentityType";

-- CreateTable
CREATE TABLE "tutorial_videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutorial_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_progress" (
    "id" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "tutorial_video_id" TEXT NOT NULL,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "max_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "last_position_seconds" INTEGER,
    "last_reported_at" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_option_id" TEXT NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "topic" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "type" "ExamType" NOT NULL DEFAULT 'entrance',
    "question_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answers" JSONB,
    "score" INTEGER,
    "percent" INTEGER,
    "passed" BOOLEAN,
    "critical_failed" BOOLEAN,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "pdf_path" TEXT,
    "qr_target_url" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'active',
    "issued_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_member_profile_id_tutorial_video_id_key" ON "video_progress"("member_profile_id", "tutorial_video_id");

-- CreateIndex
CREATE INDEX "exam_questions_is_active_idx" ON "exam_questions"("is_active");

-- CreateIndex
CREATE INDEX "exam_attempts_member_profile_id_started_at_idx" ON "exam_attempts"("member_profile_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_number_key" ON "certificates"("number");

-- CreateIndex
CREATE INDEX "certificates_member_profile_id_idx" ON "certificates"("member_profile_id");

-- AddForeignKey
ALTER TABLE "tutorial_videos" ADD CONSTRAINT "tutorial_videos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_tutorial_video_id_fkey" FOREIGN KEY ("tutorial_video_id") REFERENCES "tutorial_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
