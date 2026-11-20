-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('days_60', 'days_30', 'days_7', 'expiry_confirmation');

-- CreateTable
CREATE TABLE "reminder_points" (
    "id" TEXT NOT NULL,
    "member_profile_id" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_points_due_at_sent_at_idx" ON "reminder_points"("due_at", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_points_member_profile_id_kind_due_at_key" ON "reminder_points"("member_profile_id", "kind", "due_at");

-- AddForeignKey
ALTER TABLE "reminder_points" ADD CONSTRAINT "reminder_points_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "member_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
