import { and, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatives } from "@/db/schema";
import { periodSchema, attributionWarning } from "./connectors/types";
import { c, m, campaignFilter, metricAggregates, metricWindow } from "./metrics";
import { tenantWhere } from "./tenant-scope";
export type RankedMetric = {
  creative_key: string;
  metric: string;
  value: string;
  rank: number;
  percentile: number;
};
export function summarizeRankings(rows: RankedMetric[]) {
  const top: Record<string, RankedMetric[]> = {};
  for (const r of rows) if (r.rank <= 5) (top[r.metric] ??= []).push(r);
  const byCreative = new Map<string, RankedMetric[]>();
  for (const r of rows)
    (
      byCreative.get(r.creative_key) ??
      (byCreative.set(r.creative_key, []), byCreative.get(r.creative_key)!)
    ).push(r);
  const intersections = [...byCreative]
    .map(([creative_key, metrics]) => {
      const groups = metrics.filter((r) => r.rank <= 5).map((r) => r.metric);
      const attention = metrics.filter((r) =>
        ["ctr", "hook_rate", "body_rate"].includes(r.metric),
      );
      const sales = metrics.filter((r) =>
        ["approved_sales", "revenue_cents", "profit_cents", "roas"].includes(
          r.metric,
        ),
      );
      return {
        creative_key,
        groups,
        attentionStrongSalesWeak:
          attention.some((r) => r.rank <= 5) &&
          sales.some((r) => r.percentile > 0.5),
        salesStrongAttentionMedian:
          sales.some((r) => r.rank <= 5) &&
          attention.some((r) => r.percentile >= 0.5),
      };
    })
    .filter((r) => r.groups.length);
  return {
    top,
    intersections,
    warning: rows.length ? null : attributionWarning,
  };
}
export async function getBenchmark(tenantId: string, input: unknown) {
  const p = periodSchema.parse(input);
  const totals = sql.join(
    Object.entries(metricAggregates()).map(
      ([name, expression]) => sql`${expression} ${sql.identifier(name)}`,
    ),
    sql`, `,
  );
  const result = await db.execute(sql`
 WITH totals AS (
 SELECT c.creative_key, ${totals}
 FROM creatives c JOIN creative_metrics m ON m.tenant_id=c.tenant_id AND m.creative_id=c.id
 WHERE ${and(tenantWhere(c, tenantId), tenantWhere(m, tenantId), metricWindow(p), campaignFilter(p))}
 GROUP BY c.id,c.creative_key
 ), expanded AS (
 SELECT creative_key,metric,value FROM totals CROSS JOIN LATERAL (VALUES ('spend_cents',spend_cents),('impressions',impressions),('clicks',clicks),('leads',leads),('checkouts',checkouts),('refunds',refunds),('chargebacks',chargebacks),('approved_sales',approved_sales),('revenue_cents',revenue_cents),('profit_cents',profit_cents),('roas',roas::numeric),('ctr',ctr::numeric),('hook_rate',hook_rate::numeric),('body_rate',body_rate::numeric)) v(metric,value) WHERE value IS NOT NULL
 ) SELECT creative_key,metric,value::text,ROW_NUMBER() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refunds','chargebacks') THEN -value ELSE value END DESC,creative_key)::int rank,PERCENT_RANK() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refunds','chargebacks') THEN -value ELSE value END DESC) percentile FROM expanded ORDER BY metric,rank`);
  const summarized = summarizeRankings(result.rows as RankedMetric[]);
  if (!result.rows.length) {
    const [known] = await db
      .select({ id: creatives.id })
      .from(creatives)
      .where(tenantWhere(creatives, tenantId))
      .limit(1);
    if (known)
      summarized.warning =
        "Nenhuma métrica comparável neste período e fonte. CSV exige o período exato da importação.";
  }
  return summarized;
}
