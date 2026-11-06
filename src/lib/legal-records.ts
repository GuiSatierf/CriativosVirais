import "server-only";
import { db } from "@/db";
import { accessLog } from "@/db/schema";
import { logError } from "./log";

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
