import { sql } from "drizzle-orm";
import { db } from "@/db";
import { handle, apiTenant, json } from "@/lib/http";
import { periodSchema } from "@/lib/connectors/types";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const p = periodSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await db.execute(
      sql`SELECT c.creative_key,c.name,c.campaign_key,m.period_from::text,m.period_to::text,m.spend_cents::text,m.impressions::text,m.clicks::text,m.ctr,m.hook_rate,m.body_rate,m.leads::text,m.checkouts::text,m.approved_sales::text,m.revenue_cents::text,m.profit_cents::text,m.roas,m.refunds::text,m.chargebacks::text,(SELECT a.status FROM assets a WHERE a.tenant_id=${tenantId} AND a.creative_id=c.id AND a.upload_completed_at IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) video_status FROM creatives c LEFT JOIN creative_metrics m ON m.tenant_id=${tenantId} AND m.creative_id=c.id AND m.source=${p.source} AND ((${p.source}='csv' AND m.period_from=${p.from}::date AND m.period_to=${p.to}::date) OR (${p.source}='webhook' AND m.period_from>=${p.from}::date AND m.period_to<=${p.to}::date)) WHERE c.tenant_id=${tenantId} AND (${p.campaignKey ?? null}::text IS NULL OR c.campaign_key=${p.campaignKey ?? null}) ORDER BY c.creative_key,m.period_from LIMIT 1000`,
    );
    return json(result.rows);
  });
}
