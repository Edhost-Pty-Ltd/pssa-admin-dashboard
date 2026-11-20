/**
 * Creates the admin account. This is the only way to create an ADMIN: there is no public admin sign-up.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
 *
 * (or put ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env). Running it again leaves an existing admin unchanged,
 * unless ADMIN_RESET_PASSWORD=true, which sets the new password and signs that admin out everywhere.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordSchema } from "../src/lib/password.js";

const prisma = new PrismaClient();

function fail(message: string): never {
  console.error(`[seed] ${message}`);
  process.exit(1);
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) fail("Set ADMIN_EMAIL and ADMIN_PASSWORD (in backend/.env or the shell) to create the admin account.");

  const checked = passwordSchema.safeParse(password);
  if (!checked.success) fail(`ADMIN_PASSWORD ${checked.error.issues[0]?.message}.`);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing && existing.role !== "ADMIN") {
    fail(`${email} already belongs to a ${existing.role.toLowerCase()} account. Use a different ADMIN_EMAIL.`);
  }

  if (existing) {
    if (process.env.ADMIN_RESET_PASSWORD !== "true") {
      console.log(`[seed] Admin ${email} already exists; left unchanged.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
    });
    console.log(`[seed] Admin ${email}: password reset.`);
    return;
  }

  await prisma.user.create({
    data: {
      role: "ADMIN",
      email,
      passwordHash: await hashPassword(password),
      firstName: process.env.ADMIN_FIRST_NAME?.trim() || "Platform",
      lastName: process.env.ADMIN_LAST_NAME?.trim() || "Admin",
    },
  });
  console.log(`[seed] Admin ${email} created.`);
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
