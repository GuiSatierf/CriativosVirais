import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeMetrics } from "@/db/schema";
import { spDay } from "./dates";
import { tenantWhere } from "./tenant-scope";

/**
 * Period the metrics screens open on. CSV metrics only match their exact
 * import period, so the latest import wins; otherwise the last 30 days.
 */
export async function defaultMetricsPeriod(tenantId: string) {
  const [latest] = await db
    .select({ from: creativeMetrics.periodFrom, to: creativeMetrics.periodTo })
    .from(creativeMetrics)
    .where(tenantWhere(creativeMetrics, tenantId, eq(creativeMetrics.source, "csv")))
    .orderBy(desc(creativeMetrics.periodTo), desc(creativeMetrics.periodFrom))
    .limit(1);
  return {
    from: latest?.from ?? spDay(new Date(Date.now() - 30 * 86400000)),
    to: latest?.to ?? spDay(new Date()),
    source: "csv" as const,
  };
}
