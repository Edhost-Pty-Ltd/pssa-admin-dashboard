import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_COST = 12;
/** bcrypt only uses the first 72 bytes of a password, so longer ones are rejected rather than silently truncated. */
const BCRYPT_MAX_BYTES = 72;

export const passwordSchema = z
  .string({ error: "is required" })
  .min(8, "must be at least 8 characters")
  .refine((value) => Buffer.byteLength(value) <= BCRYPT_MAX_BYTES, `must be at most ${BCRYPT_MAX_BYTES} characters`)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), "must contain at least one letter and one number");

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * A real hash of a random value, compared against when the email does not exist,
 * so a failed login takes the same time whether or not the account exists.
 */
const DUMMY_HASH = bcrypt.hashSync(`no-such-user-${Math.random()}`, BCRYPT_COST);

export async function verifyPasswordOrDummy(plain: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}
