import { desc, eq, ne, sql } from "drizzle-orm";
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

/** How many recent imports Resultados offers when the chosen period has none. */
const offeredImports = 3;

/** Latest CSV import periods, newest first, offered when a chosen period has no import. */
export async function csvImportPeriods(
  tenantId: string,
  count = offeredImports,
): Promise<{ from: string; to: string }[]> {
  return db
    .selectDistinct({ from: creativeMetrics.periodFrom, to: creativeMetrics.periodTo })
    .from(creativeMetrics)
    .where(tenantWhere(creativeMetrics, tenantId, eq(creativeMetrics.source, "csv")))
    .orderBy(desc(creativeMetrics.periodTo), desc(creativeMetrics.periodFrom))
    .limit(count);
}

/** How many CSV imports the assistant is offered as separate windows, newest first. */
const offeredCsvWindows = 10;

/**
 * Windows the assistant's metric tools can query. A CSV snapshot only matches its exact import
 * period, so each recent import is its own window; webhook days fall inside one span per source.
 */
export async function availableMetricWindows(tenantId: string) {
  const [imports, spans] = await Promise.all([
    csvImportPeriods(tenantId, offeredCsvWindows),
    db
      .select({
        source: creativeMetrics.source,
        from: sql<string>`min(${creativeMetrics.periodFrom})::text`,
        to: sql<string>`max(${creativeMetrics.periodTo})::text`,
      })
      .from(creativeMetrics)
      .where(tenantWhere(creativeMetrics, tenantId, ne(creativeMetrics.source, "csv")))
      .groupBy(creativeMetrics.source),
  ]);
  return [...imports.map((period) => ({ source: "csv", ...period })), ...spans];
}
