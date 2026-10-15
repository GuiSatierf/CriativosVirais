import { and, getTableColumns, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { creativeMetrics, creatives } from "@/db/schema";
import type { db } from "@/db";
import type { periodSchema } from "./connectors/types";
import type { z } from "zod";

export type Period = z.output<typeof periodSchema>;
type Executor = Pick<typeof db, "insert">;
type MetricColumn = keyof typeof creativeMetrics.$inferSelect;
type MetricColumns = Record<MetricColumn, SQLWrapper>;

/** Aliases for raw SQL that joins `creatives c` and `creative_metrics m`. */
export const c = alias(creatives, "c");
export const m = alias(creativeMetrics, "m");

/** Source and window match: CSV needs the exact imported period; webhook days fall inside it. */
export function metricWindow(p: Period, cols: MetricColumns = m) {
  return and(
    sql`${cols.source}=${p.source}`,
    p.source === "csv"
      ? sql`${cols.periodFrom}=${p.from}::date AND ${cols.periodTo}=${p.to}::date`
      : sql`${cols.periodFrom}>=${p.from}::date AND ${cols.periodTo}<=${p.to}::date`,
  )!;
}
export function campaignFilter(p: Period, cols: MetricColumns = m): SQL | undefined {
  return p.campaignKey ? sql`${cols.campaignKey}=${p.campaignKey}` : undefined;
}

/**
 * Per-creative aggregation across snapshots. Totals stay NULL when any snapshot
 * lacks the value; CTR/ROAS derive from summed denominators; Hook/Body Rate are
 * not aggregable and survive only for a single snapshot.
 */
export function metricAggregates(cols: MetricColumns = m) {
  const total = (column: SQLWrapper) =>
    sql`CASE WHEN count(${column})=count(*) THEN sum(${column}) END`;
  const single = (column: SQLWrapper) =>
    sql`CASE WHEN count(*)=1 THEN max(${column}) END`;
  return {
    spend_cents: total(cols.spendCents),
    impressions: total(cols.impressions),
    clicks: total(cols.clicks),
    leads: total(cols.leads),
    checkouts: total(cols.checkouts),
    approved_sales: total(cols.approvedSales),
    revenue_cents: total(cols.revenueCents),
    profit_cents: total(cols.profitCents),
    refunds: total(cols.refunds),
    chargebacks: total(cols.chargebacks),
    ctr: sql`CASE WHEN count(${cols.clicks})=count(*) AND count(${cols.impressions})=count(*) AND sum(${cols.impressions})>0 THEN 100.0*sum(${cols.clicks})/sum(${cols.impressions}) WHEN count(*)=1 THEN max(${cols.ctr}) END`,
    roas: sql`CASE WHEN count(${cols.revenueCents})=count(*) AND count(${cols.spendCents})=count(*) AND sum(${cols.spendCents})>0 THEN sum(${cols.revenueCents})::numeric/sum(${cols.spendCents}) WHEN count(*)=1 THEN max(${cols.roas}) END`,
    hook_rate: single(cols.hookRate),
    body_rate: single(cols.bodyRate),
  };
}

export const nullableBigint = (v: string | null) => (v === null ? null : BigInt(v));

const metricKey = [
  creativeMetrics.tenantId,
  creativeMetrics.creativeId,
  creativeMetrics.periodFrom,
  creativeMetrics.periodTo,
  creativeMetrics.source,
  creativeMetrics.campaignKey,
];
const columns = getTableColumns(creativeMetrics);

/** Upserts snapshots, replacing only the columns present in the rows. All rows must share keys. */
export function upsertCreativeMetrics(
  tx: Executor,
  rows: (typeof creativeMetrics.$inferInsert)[],
) {
  const set = Object.fromEntries(
    Object.keys(rows[0])
      .filter((key) => key !== "id")
      .map((key) => [
        key,
        sql.raw(`excluded."${columns[key as MetricColumn].name}"`),
      ]),
  );
  return tx
    .insert(creativeMetrics)
    .values(rows)
    .onConflictDoUpdate({ target: metricKey, set });
}
