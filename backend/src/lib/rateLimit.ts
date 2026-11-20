import rateLimit from "express-rate-limit";
import { config } from "../config.js";

/** Slows down password guessing and mass sign-ups. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 30 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again.", errors: ["Too many attempts. Please wait a few minutes and try again."] },
});
