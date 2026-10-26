import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { accessLog, legalAcceptances } from "@/db/schema";
import { legalVersion } from "./legal";
import { logError } from "./log";

export async function hasAcceptedCurrentTerms(userId: string) {
  const [acceptance] = await db
    .select({ id: legalAcceptances.id })
    .from(legalAcceptances)
    .where(and(eq(legalAcceptances.userId, userId), gte(legalAcceptances.version, legalVersion)))
    .limit(1);
  return acceptance != null;
}

/** Records that this person accepted the current terms; accepting twice keeps the first record. */
export async function recordTermsAcceptance(userId: string) {
  await db.insert(legalAcceptances).values({ userId, version: legalVersion }).onConflictDoNothing();
}

type StartedSession = {
  userId: string;
  impersonatedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** One access record per sign-in or support visit. A lost record never blocks the sign-in. */
export async function recordAccess(session: StartedSession) {
  try {
    await db.insert(accessLog).values({
      userId: session.userId,
      impersonatedBy: session.impersonatedBy ?? null,
      ipAddress: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
    });
  } catch (error) {
    logError("access-log", error);
  }
}
