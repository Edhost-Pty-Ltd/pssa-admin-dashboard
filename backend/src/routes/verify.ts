import { Router } from "express";
import { findCertificateByNumber, serializePublicCertificate } from "../lib/certificates.js";
import { notFound } from "../lib/http.js";

/**
 * Public live-check for a certificate number.
 * Screenshots and PDFs are not proof — only this endpoint reflects current status.
 * Response shape matches the member portal CertificateCheck type.
 */
export const verifyRouter = Router();

verifyRouter.get("/:certificateNumber", async (req, res) => {
  const number = String(req.params.certificateNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^PSSA-\d{4}-\d{6}$/.test(number)) throw notFound("Certificate not found.");

  const certificate = await findCertificateByNumber(number);
  if (!certificate?.member) throw notFound("Certificate not found.");

  res.json({
    certificate: serializePublicCertificate({
      certificate,
      profile: certificate.member,
      channels: certificate.member.channels,
    }),
  });
});
