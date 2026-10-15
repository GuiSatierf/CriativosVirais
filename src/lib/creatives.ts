import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { periodSchema } from "./connectors/types";
import { c, m, campaignFilter, metricWindow } from "./metrics";
import { tenantWhere } from "./tenant-scope";

const limit = 1000;
export async function getCreatives(tenantId: string, input: unknown) {
  const p = periodSchema.parse(input);
  const result = await db.execute(sql`
    SELECT c.creative_key, c.name, c.hidden_at IS NOT NULL hidden, nullif(m.campaign_key, '') campaign_key,
      m.period_from::text, m.period_to::text, m.spend_cents::text,
      m.impressions::text, m.clicks::text,
      -- Same derivation as metricAggregates: computed from components when present.
      CASE WHEN m.clicks IS NOT NULL AND m.impressions > 0
        THEN 100.0 * m.clicks / m.impressions ELSE m.ctr END::float8 ctr,
      m.hook_rate, m.body_rate,
      m.leads::text, m.checkouts::text, m.approved_sales::text,
      m.revenue_cents::text, m.profit_cents::text,
      CASE WHEN m.revenue_cents IS NOT NULL AND m.spend_cents > 0
        THEN m.revenue_cents::numeric / m.spend_cents ELSE m.roas END::float8 roas,
      m.refunds::text, m.chargebacks::text,
      (SELECT ${assets.status} FROM ${assets} WHERE ${tenantWhere(
        assets,
        tenantId,
        eq(assets.creativeId, c.id),
        isNotNull(assets.uploadCompletedAt),
      )}
        ORDER BY ${assets.createdAt} DESC LIMIT 1) video_status
    FROM creatives c LEFT JOIN creative_metrics m ON ${tenantWhere(
      m,
      tenantId,
      eq(m.creativeId, c.id),
      metricWindow(p),
    )}
    WHERE ${and(tenantWhere(c, tenantId), campaignFilter(p))}
    ORDER BY c.creative_key, m.period_from, m.campaign_key LIMIT ${limit + 1}
  `);
  return {
    rows: result.rows.slice(0, limit),
    truncated: result.rows.length > limit,
  };
}
