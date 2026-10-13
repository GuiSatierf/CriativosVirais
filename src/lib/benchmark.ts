import { sql } from "drizzle-orm";
import { db } from "@/db";
import { periodSchema, attributionWarning } from "./connectors/types";
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
  const result = await db.execute(sql`
 WITH totals AS (
 SELECT c.creative_key,
 CASE WHEN count(m.impressions)=count(*) THEN sum(m.impressions) END impressions,
 CASE WHEN count(m.clicks)=count(*) THEN sum(m.clicks) END clicks,
 CASE WHEN count(m.leads)=count(*) THEN sum(m.leads) END leads,
 CASE WHEN count(m.checkouts)=count(*) THEN sum(m.checkouts) END checkouts,
 CASE WHEN count(m.refunds)=count(*) THEN sum(m.refunds) END refunds,
 CASE WHEN count(m.chargebacks)=count(*) THEN sum(m.chargebacks) END chargebacks,
 CASE WHEN count(m.approved_sales)=count(*) THEN sum(m.approved_sales) END approved_sales,
 CASE WHEN count(m.revenue_cents)=count(*) THEN sum(m.revenue_cents) END revenue_cents,
 CASE WHEN count(m.profit_cents)=count(*) THEN sum(m.profit_cents) END profit_cents,
 CASE WHEN count(m.spend_cents)=count(*) THEN sum(m.spend_cents) END spend_cents,
 CASE WHEN count(m.clicks)=count(*) AND count(m.impressions)=count(*) AND sum(m.impressions)>0 THEN 100.0*sum(m.clicks)/sum(m.impressions) WHEN count(*)=1 THEN max(m.ctr) END ctr,
 CASE WHEN count(*)=1 THEN max(m.hook_rate) END hook_rate,
 CASE WHEN count(*)=1 THEN max(m.body_rate) END body_rate,
 CASE WHEN count(m.revenue_cents)=count(*) AND count(m.spend_cents)=count(*) AND sum(m.spend_cents)>0 THEN sum(m.revenue_cents)::numeric/sum(m.spend_cents) WHEN count(*)=1 THEN max(m.roas) END roas
 FROM creatives c JOIN creative_metrics m ON m.tenant_id=c.tenant_id AND m.creative_id=c.id
 WHERE c.tenant_id=${tenantId} AND m.tenant_id=${tenantId} AND m.source=${p.source}
 AND ((${p.source}='csv' AND m.period_from=${p.from}::date AND m.period_to=${p.to}::date) OR (${p.source}='webhook' AND m.period_from>=${p.from}::date AND m.period_to<=${p.to}::date))
 AND (${p.campaignKey ?? null}::text IS NULL OR c.campaign_key=${p.campaignKey ?? null}) GROUP BY c.id,c.creative_key
 ), expanded AS (
 SELECT creative_key,metric,value FROM totals CROSS JOIN LATERAL (VALUES ('spend_cents',spend_cents),('impressions',impressions),('clicks',clicks),('leads',leads),('checkouts',checkouts),('refunds',refunds),('chargebacks',chargebacks),('approved_sales',approved_sales),('revenue_cents',revenue_cents),('profit_cents',profit_cents),('roas',roas::numeric),('ctr',ctr::numeric),('hook_rate',hook_rate::numeric),('body_rate',body_rate::numeric)) v(metric,value) WHERE value IS NOT NULL
 ) SELECT creative_key,metric,value::text,ROW_NUMBER() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refunds','chargebacks') THEN -value ELSE value END DESC,creative_key)::int rank,PERCENT_RANK() OVER(PARTITION BY metric ORDER BY CASE WHEN metric IN ('refunds','chargebacks') THEN -value ELSE value END DESC) percentile FROM expanded ORDER BY metric,rank`);
  const summarized = summarizeRankings(result.rows as RankedMetric[]);
  if (!result.rows.length) {
    const known = await db.execute(
      sql`SELECT 1 FROM creatives WHERE tenant_id=${tenantId} LIMIT 1`,
    );
    if (known.rows.length)
      summarized.warning =
        "Nenhuma métrica comparável neste período e fonte. CSV exige o período exato da importação.";
  }
  return summarized;
}
