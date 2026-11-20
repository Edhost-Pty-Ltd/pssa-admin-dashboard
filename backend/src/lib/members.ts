import { Prisma } from "@prisma/client";
import { z } from "zod";
import { conflict } from "./http.js";
import { hashPassword, passwordSchema } from "./password.js";
import { prisma } from "./prisma.js";

const requiredText = (max: number) =>
  z
    .string({ error: (issue) => (issue.input === undefined || issue.input === null ? "is required" : "must be text") })
    .trim()
    .min(1, "is required")
    .max(max, `must be at most ${max} characters`);

/** Treats "", whitespace and null as "not provided". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value), schema.optional());

/** South African ID: 13 digits, a real YYMMDD birth date, and a valid Luhn check digit. */
export function isValidSaIdNumber(id: string) {
  if (!/^\d{13}$/.test(id)) return false;
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  const validDate = [1900, 2000].some((century) => {
    const d = new Date(Date.UTC(century + yy, mm - 1, dd));
    return d.getUTCFullYear() === century + yy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
  });
  if (!validDate) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = Number(id[12 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Passport / travel document number: 6–12 letters or digits (overseas identity route). */
export function isValidPassportNumber(value: string) {
  return /^[A-Za-z0-9]{6,12}$/.test(value);
}

export function isValidIdentityNumber(identityType: "sa_id" | "passport", value: string) {
  return identityType === "sa_id" ? isValidSaIdNumber(value) : isValidPassportNumber(value);
}

export const accountSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  email: requiredText(150).toLowerCase().pipe(z.email("must be a valid email address")),
  password: passwordSchema,
  phone: optional(
    z
      .string({ error: "must be text" })
      .trim()
      .max(30, "must be at most 30 characters")
      .refine((v) => /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15, "must be a valid phone number"),
  ),
});

/** Public sign-up can create MEMBER (the default) or CUSTOMER accounts, never ADMIN. */
export const signUpRoleSchema = z.object({
  role: optional(z.enum(["MEMBER", "CUSTOMER"], { error: "must be MEMBER or CUSTOMER" })).default("MEMBER"),
});

export const customerRegistrationSchema = accountSchema;

export const memberRegistrationSchema = accountSchema.extend({
  idNumber: optional(
    z
      .string({ error: "must be text" })
      .transform((v) => v.replace(/\s/g, ""))
      .refine(isValidSaIdNumber, "must be a valid 13-digit South African ID number"),
  ),
  tradingName: optional(z.string({ error: "must be text" }).trim().max(150, "must be at most 150 characters")),
  scope: optional(z.string({ error: "must be text" }).trim().max(150, "must be at most 150 characters")),
});

export type MemberRegistration = z.infer<typeof memberRegistrationSchema>;
export type CustomerRegistration = z.infer<typeof customerRegistrationSchema>;

export const userSelect = {
  id: true,
  email: true,
  role: true,
  tokenVersion: true,
  firstName: true,
  lastName: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  memberProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      tradingName: true,
      scope: true,
      identityType: true,
      idNumber: true,
      physicalAddress: true,
      city: true,
      memberStatus: true,
      validFrom: true,
      validUntil: true,
      createdAt: true,
    },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** ID numbers are never sent back in full. */
export const maskIdNumber = (id: string | null | undefined) => (id ? `${"•".repeat(Math.max(0, id.length - 4))}${id.slice(-4)}` : null);

export function serializeUser({ tokenVersion: _tv, ...user }: SelectedUser) {
  return {
    ...user,
    memberProfile: user.memberProfile
      ? { ...user.memberProfile, idNumber: maskIdNumber(user.memberProfile.idNumber) }
      : null,
  };
}

async function assertEmailFree(email: string) {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw conflict("An account with this email already exists. Try signing in instead.", { fields: { email: "is already registered" } });
  }
}

export async function createCustomer(input: CustomerRegistration) {
  await assertEmailFree(input.email);
  return prisma.user.create({
    data: {
      role: "CUSTOMER",
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
    },
    select: userSelect,
  });
}

export async function createMember(input: MemberRegistration) {
  await assertEmailFree(input.email);
  if (input.idNumber && (await prisma.memberProfile.findUnique({ where: { idNumber: input.idNumber }, select: { id: true } }))) {
    throw conflict("A member with this ID number is already registered.", { fields: { idNumber: "is already registered" } });
  }
  const created = await prisma.user.create({
    data: {
      role: "MEMBER",
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      memberProfile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
          tradingName: input.tradingName ?? null,
          scope: input.scope ?? null,
          idNumber: input.idNumber ?? null,
        },
      },
    },
    select: userSelect,
  });
  await prisma.adminNotification
    .create({
      data: {
        title: "New member account created",
        body: `${created.firstName} ${created.lastName} (${created.email}) registered and must complete verification before activation.`,
        type: "INFO",
        link: "/admin/verifications",
      },
    })
    .catch(() => {});
  return created;
}

const passwordlessMemberSelect = { id: true, email: true, role: true } as const;

/**
 * Find a member by email, or create a passwordless MEMBER for public OTP sign-in.
 * Profile fields are filled later on the member application steps.
 */
export async function findOrCreatePasswordlessMember(email: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: passwordlessMemberSelect });
  if (existing) return existing;

  try {
    const created = await prisma.user.create({
      data: {
        role: "MEMBER",
        email,
        passwordHash: null,
        firstName: "",
        lastName: "",
        memberProfile: { create: { firstName: "", lastName: "" } },
      },
      select: passwordlessMemberSelect,
    });
    await prisma.adminNotification
      .create({
        data: {
          title: "New member account created",
          body: `${email} started onboarding and must complete verification before activation.`,
          type: "INFO",
          link: "/admin/verifications",
        },
      })
      .catch(() => {});
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.user.findUniqueOrThrow({ where: { email }, select: passwordlessMemberSelect });
    }
    throw error;
  }
}

/** Issues APP-YYYY-XXXX numbers for applications. */
export async function nextApplicationNumber(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const year = new Date().getFullYear();
  const prefix = `APP-${year}-`;
  const latest = await tx.application.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const next = latest ? Number(latest.number.slice(-4)) + 1 : 1;
  if (!Number.isFinite(next) || next < 1 || next > 9999) {
    throw conflict("Could not allocate an application number. Please try again.");
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}
