import { prisma } from "./prisma.js";

const PRIVATE_FILE_TYPES = ["id_document", "bank_evidence"] as const;

/** Identity and bank files whose retain-until date has passed and which are not purged yet. */
export async function identityAndBankFilesDue(now = new Date()) {
  return prisma.document.findMany({
    where: {
      type: { in: [...PRIVATE_FILE_TYPES] },
      purgedAt: null,
      retainUntil: { lte: now },
    },
    orderBy: { retainUntil: "asc" },
    select: {
      id: true,
      userId: true,
      type: true,
      storagePath: true,
      originalName: true,
      retainUntil: true,
    },
  });
}

/** Record that the private file has been removed. Ryan deletes the stored file first. */
export async function markPrivateFilePurged(documentId: string, purgedAt = new Date()) {
  return prisma.document.update({
    where: { id: documentId },
    data: { purgedAt, storagePath: "" },
    select: { id: true, type: true, purgedAt: true },
  });
}