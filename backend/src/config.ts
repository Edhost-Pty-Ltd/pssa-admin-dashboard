import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5174"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration (check backend/.env against backend/.env.example):");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === "production",
  port: env.PORT,
  clientOrigin: env.CLIENT_ORIGIN,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresInDays: env.JWT_EXPIRES_IN_DAYS,
  mail: {
    host: env.SMTP_HOST || null,
    port: env.SMTP_PORT,
    /** Port 465 uses TLS from the start; 587 upgrades with STARTTLS. */
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : env.SMTP_PORT === 465,
    user: env.SMTP_USER || null,
    pass: env.SMTP_PASS || null,
    from: env.MAIL_FROM || null,
  },
} as const;
