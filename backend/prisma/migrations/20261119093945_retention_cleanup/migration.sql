-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "purged_at" TIMESTAMP(3),
ADD COLUMN     "retain_until" TIMESTAMP(3);
