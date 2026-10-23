import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { verification } from "@/db/schema";

/**
 * One-time code an operator hands to a new admin with make-admin. Two-factor enrollment of an
 * admin requires it, so a leaked password alone cannot enroll someone else's phone.
 */
export const enrollmentHeader = "x-admin-enrollment-code";
const enrollmentValidMs = 24 * 60 * 60_000;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const identifierOf = (userId: string) => `admin-enrollment:${userId}`;
const hashOf = (code: string) => createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

/** Replaces any previous code and returns the new one, shown once to the operator. */
export async function issueEnrollmentCode(userId: string) {
  const code = Array.from(randomBytes(12), (byte) => codeAlphabet[byte % codeAlphabet.length]).join("");
  await db.delete(verification).where(eq(verification.identifier, identifierOf(userId)));
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: identifierOf(userId),
    value: hashOf(code),
    expiresAt: new Date(Date.now() + enrollmentValidMs),
  });
  return code.match(/.{4}/g)?.join("-") ?? code;
}

export async function isValidEnrollmentCode(userId: string, code: string | null) {
  if (code == null || code.trim().length === 0) return false;
  const [stored] = await db
    .select({ value: verification.value })
    .from(verification)
    .where(and(eq(verification.identifier, identifierOf(userId)), gt(verification.expiresAt, new Date())));
  if (stored == null) return false;
  const expected = Buffer.from(stored.value, "hex");
  const given = Buffer.from(hashOf(code), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
