import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { config } from "../config.js";
import type { CertificateRow } from "./certificates.js";
import { prisma } from "./prisma.js";
import { privateFilePath } from "./uploads.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGO_CANDIDATES = [
  path.join(backendRoot, "storage", "branding", "logo.png"),
  path.join(backendRoot, "storage", "branding", "logo.jpg"),
];

export function certificatePdfFilename(number: string) {
  return `certificate-${number.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

/** Absolute URL encoded in the QR (frontend live-check page). */
export function verifyPageUrl(number: string) {
  return `${config.clientOrigin.replace(/\/$/, "")}/verify/${number}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(value);
}

export async function renderCertificatePdf(input: {
  number: string;
  firstName: string;
  lastName: string;
  tradingName: string | null;
  scope: string | null;
  validFrom: Date;
  validUntil: Date;
}): Promise<Buffer> {
  const verifyUrl = verifyPageUrl(input.number);
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  const logoPath = LOGO_CANDIDATES.find((candidate) => existsSync(candidate));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 48,
      info: {
        Title: `PSSA Certificate ${input.number}`,
        Author: "Private Sellers Standards Authority",
        Subject: "Membership certificate",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    doc.rect(24, 24, pageWidth - 48, pageHeight - 48).lineWidth(2).stroke("#0B1F3A");
    doc.rect(32, 32, pageWidth - 64, pageHeight - 64).lineWidth(0.5).stroke("#C5A46E");

    if (logoPath) {
      try {
        doc.image(logoPath, pageWidth / 2 - 36, 48, { width: 72, height: 72, fit: [72, 72] });
      } catch {
        // Logo is optional until the senior provides the official file.
      }
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#0B1F3A")
        .text("PSSA", 0, 56, { align: "center" });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor("#0B1F3A")
      .text("Private Sellers Standards Authority", 60, logoPath ? 130 : 90, { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#44546A")
      .text("Certificate of Membership", 60, logoPath ? 168 : 128, { align: "center" });

    const fullName = `${input.firstName} ${input.lastName}`.trim() || "Member";
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#0B1F3A")
      .text(fullName, 60, 210, { align: "center" });

    if (input.tradingName) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#44546A")
        .text(`Trading as ${input.tradingName}`, 60, 250, { align: "center" });
    }

    const detailsTop = input.tradingName ? 290 : 270;
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#0B1F3A")
      .text(`Certificate number: ${input.number}`, 80, detailsTop)
      .text(`Valid from: ${formatDate(input.validFrom)}`, 80, detailsTop + 22)
      .text(`Valid until: ${formatDate(input.validUntil)}`, 80, detailsTop + 44)
      .text(`Scope: ${input.scope?.trim() || "General membership"}`, 80, detailsTop + 66);

    doc.image(qrPng, pageWidth - 260, detailsTop - 10, { width: 140, height: 140 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#44546A")
      .text("Scan for live status", pageWidth - 260, detailsTop + 136, { width: 140, align: "center" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#66788A")
      .text(
        "This PDF is not proof of current membership. Always confirm status at the live check URL encoded in the QR code.",
        80,
        pageHeight - 90,
        { width: pageWidth - 160, align: "center" },
      );

    doc.end();
  });
}

/** Write the PDF to private storage and persist pdfPath on the certificate row. */
export async function ensureCertificatePdf(
  certificate: CertificateRow,
  member: { firstName: string; lastName: string; tradingName: string | null; scope: string | null },
): Promise<CertificateRow> {
  const filename = certificate.pdfPath || certificatePdfFilename(certificate.number);
  const fullPath = privateFilePath(filename);
  mkdirSync(path.dirname(fullPath), { recursive: true });

  if (!certificate.pdfPath || !existsSync(fullPath)) {
    const buffer = await renderCertificatePdf({
      number: certificate.number,
      firstName: member.firstName,
      lastName: member.lastName,
      tradingName: member.tradingName,
      scope: certificate.scope ?? member.scope,
      validFrom: certificate.validFrom,
      validUntil: certificate.validUntil,
    });
    writeFileSync(fullPath, buffer);
    if (certificate.pdfPath !== filename) {
      return prisma.certificate.update({
        where: { id: certificate.id },
        data: { pdfPath: filename },
        select: {
          id: true,
          number: true,
          issuedAt: true,
          validFrom: true,
          validUntil: true,
          scope: true,
          qrTargetUrl: true,
          status: true,
          pdfPath: true,
          createdAt: true,
        },
      });
    }
  }

  return { ...certificate, pdfPath: filename };
}

export function certificatePdfDiskPath(pdfPath: string) {
  const fullPath = privateFilePath(pdfPath);
  return existsSync(fullPath) ? fullPath : null;
}
