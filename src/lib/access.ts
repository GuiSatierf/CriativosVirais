import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accessGrants } from "@/db/schema";

/** Emails are compared trimmed and lowercased everywhere: grants, sign-up and the admin list. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Whether this email may create an account (a purchase or a manual grant). */
export async function hasAccessGrant(email: string) {
  const [grant] = await db
    .select({ id: accessGrants.id })
    .from(accessGrants)
    .where(eq(accessGrants.email, normalizeEmail(email)))
    .limit(1);
  return grant !== undefined;
}
