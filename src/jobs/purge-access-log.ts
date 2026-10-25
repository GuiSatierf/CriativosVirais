import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessLog } from "@/db/schema";

/** Marco Civil, art. 15: access records are kept for six months, then deleted. Runs daily. */
export async function purgeAccessLog() {
  const removed = await db
    .delete(accessLog)
    .where(lt(accessLog.createdAt, sql`now() - interval '6 months'`))
    .returning({ id: accessLog.id });
  console.info(`[access-log] removed ${removed.length} records older than six months.`);
}
