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
// For rates where less is better, zero is the best result; for everything else zero or less won nothing.
const lowerIsBetter = new Set(["refund_rate", "chargeback_rate"]);

/** Top five of a metric, only when positive: no sales, clicks or revenue (or a loss) is not "what worked". */
function isWinner(r: RankedMetric) {
  return r.rank <= 5 && (lowerIsBetter.has(r.metric) || Number(r.value) > 0);
}

export function summarizeRankings(rows: RankedMetric[]) {
  const top: Record<string, RankedMetric[]> = {};
  for (const r of rows) if (isWinner(r)) (top[r.metric] ??= []).push(r);
  const byCreative = new Map<string, RankedMetric[]>();
  for (const r of rows)
    (
      byCreative.get(r.creative_key) ??
      (byCreative.set(r.creative_key, []), byCreative.get(r.creative_key)!)
    ).push(r);
  const intersections = [...byCreative]
    .map(([creative_key, metrics]) => {
      const groups = metrics.filter(isWinner).map((r) => r.metric);
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
          attention.some(isWinner) &&
          sales.some((r) => r.percentile > 0.5),
        salesStrongAttentionMedian:
          sales.some(isWinner) &&
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
// Section 18.4 of the master document: an extreme value from a tiny sample is not a winner.
// Ratios compete only with a sample of at least this share of the period's median (spend for
// ROAS, impressions for CTR), relative to the operation itself so small and large accounts fit.
// Without that sample (a file with ROAS but no spend) the ratio does not compete at all.
const minimumShareOfMedian = 0.2;
const minimumImpressions = 1000;

/**
 * Internal top 5 per metric. Refunds and chargebacks rank as a rate over approved sales (lower is
 * better, creatives without sales left out); ties go to the larger sample, then the key.
 */
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
 ), medians AS (
 SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY spend_cents) spend_median,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY impressions) impressions_median
 FROM totals
 ), expanded AS (
 SELECT t.creative_key,v.metric,v.value,v.sample FROM totals t CROSS JOIN medians md CROSS JOIN LATERAL (VALUES
 ('spend_cents',t.spend_cents::numeric,NULL::numeric),('impressions',t.impressions::numeric,NULL),('clicks',t.clicks::numeric,NULL),('leads',t.leads::numeric,NULL),('checkouts',t.checkouts::numeric,NULL),
 ('approved_sales',t.approved_sales::numeric,NULL),('revenue_cents',t.revenue_cents::numeric,NULL),('profit_cents',t.profit_cents::numeric,NULL),
 ('roas',CASE WHEN t.spend_cents>=${minimumShareOfMedian}*md.spend_median THEN t.roas::numeric END,t.spend_cents::numeric),
 ('ctr',CASE WHEN t.impressions>=${minimumImpressions} AND t.impressions>=${minimumShareOfMedian}*md.impressions_median THEN t.ctr::numeric END,t.impressions::numeric),
 ('refund_rate',CASE WHEN t.approved_sales>0 THEN t.refunds::numeric/t.approved_sales END,t.approved_sales::numeric),
 ('chargeback_rate',CASE WHEN t.approved_sales>0 THEN t.chargebacks::numeric/t.approved_sales END,t.approved_sales::numeric),
 ('hook_rate',t.hook_rate::numeric,NULL),('body_rate',t.body_rate::numeric,NULL)) v(metric,value,sample) WHERE v.value IS NOT NULL
 ) SELECT creative_key,metric,value::text,ROW_NUMBER() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refund_rate','chargeback_rate') THEN -value ELSE value END DESC,sample DESC NULLS LAST,creative_key)::int rank,PERCENT_RANK() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refund_rate','chargeback_rate') THEN -value ELSE value END DESC) percentile FROM expanded ORDER BY metric,rank`);
  const summarized = summarizeRankings(result.rows as RankedMetric[]);
  if (!result.rows.length) {
    const [known] = await db
      .select({ id: creatives.id })
      .from(creatives)
      .where(tenantWhere(creatives, tenantId))
      .limit(1);
    if (known)
      summarized.warning =
        p.source === "webhook"
          ? "Nenhuma venda com código de criativo neste período."
          : "Nenhuma métrica comparável neste período. A planilha precisa ser do período exato da importação.";
  }
  return summarized;
}
