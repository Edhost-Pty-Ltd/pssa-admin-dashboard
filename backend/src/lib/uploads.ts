import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { badRequest } from "./http.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Private disk root — never serve via express.static; only through authenticated routes. */
const PRIVATE_DIR = path.join(backendRoot, "storage", "private");
mkdirSync(PRIVATE_DIR, { recursive: true });

const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const documentDiskStorage = multer.diskStorage({
  destination: PRIVATE_DIR,
  filename: (_req, file, cb) => cb(null, `${randomBytes(16).toString("hex")}${DOCUMENT_TYPES[file.mimetype] ?? ""}`),
});

function documentFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (DOCUMENT_TYPES[file.mimetype]) cb(null, true);
  else cb(badRequest("Unsupported file type. Upload a PDF, JPG, PNG or WebP file."));
}

/** Member verification documents — one file per request. */
export const documentUpload = multer({
  storage: documentDiskStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: documentFileFilter,
});

/** Complaint evidence / member response attachments — up to five files per request. */
export const complaintUpload = multer({
  storage: documentDiskStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: documentFileFilter,
});

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export const VIDEO_MAX_MB = 200;

/** Tutorial videos are private files too; they are streamed only to signed-in members and admins. */
export const videoUpload = multer({
  storage: multer.diskStorage({
    destination: PRIVATE_DIR,
    filename: (_req, file, cb) => cb(null, `${randomBytes(16).toString("hex")}${VIDEO_TYPES[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_TYPES[file.mimetype]) cb(null, true);
    else cb(badRequest("Unsupported video type. Upload an MP4, WebM or MOV file."));
  },
});

/** Confirms the video bytes match the declared type, then deletes the file if they do not. */
export async function assertVideoSignature(file: Express.Multer.File) {
  const handle = await open(file.path, "r");
  const buf = Buffer.alloc(12);
  try {
    await handle.read(buf, 0, 12, 0);
  } finally {
    await handle.close();
  }
  const box = buf.subarray(4, 8).toString("latin1");
  const ok =
    (file.mimetype === "video/webm" && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) ||
    ((file.mimetype === "video/mp4" || file.mimetype === "video/quicktime") && ["ftyp", "moov", "mdat", "wide", "free"].includes(box));
  if (!ok) {
    await unlink(file.path).catch(() => {});
    throw badRequest("The file content does not match its type. Upload a valid MP4, WebM or MOV video.");
  }
}

/** Confirms the file bytes match the declared type, then deletes the file if they do not. */
export async function assertFileSignature(file: Express.Multer.File) {
  const handle = await open(file.path, "r");
  const buf = Buffer.alloc(12);
  try {
    await handle.read(buf, 0, 12, 0);
  } finally {
    await handle.close();
  }
  const ok =
    (file.mimetype === "application/pdf" && buf.subarray(0, 4).toString("latin1") === "%PDF") ||
    (file.mimetype === "image/png" && buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") ||
    (file.mimetype === "image/jpeg" && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (file.mimetype === "image/webp" && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP");
  if (!ok) {
    await unlink(file.path).catch(() => {});
    throw badRequest("The file content does not match its type. Upload a valid PDF, JPG, PNG or WebP file.");
  }
}

export function privateFilePath(storedName: string) {
  const name = path.basename(storedName);
  const full = path.join(PRIVATE_DIR, name);
  if (path.dirname(full) !== PRIVATE_DIR) throw badRequest("Invalid file reference.");
  return full;
}

export async function removePrivateFile(storedName: string) {
  await unlink(privateFilePath(storedName)).catch(() => {});
}
