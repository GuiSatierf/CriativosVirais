import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { salesEvents, creatives } from "@/db/schema";
import { spDay } from "@/lib/dates";
import { nullableBigint, upsertCreativeMetrics } from "@/lib/metrics";
import { tenantValues, tenantWhere } from "@/lib/tenant-scope";
export const eventJobSchema = z
  .object({ tenantId: z.uuid(), eventId: z.uuid() })
  .strict();
const totalsSchema = z.object({
  sales: z.string().nullable(),
  refunds: z.string().nullable(),
  chargebacks: z.string().nullable(),
  revenue: z.string().nullable(),
  profit: z.string().nullable(),
});
export async function ingestEvent(data: unknown) {
  const { tenantId, eventId } = eventJobSchema.parse(data);
  const [event] = await db
    .select()
    .from(salesEvents)
    .where(tenantWhere(salesEvents, tenantId, eq(salesEvents.id, eventId)));
  if (!event) return;
  const key = event.creativeKey || event.utmContent;
  if (!key) return;
  const day = spDay(event.occurredAt);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},2))`,
    );
    const [creative] = await tx
      .insert(creatives)
      .values(
        tenantValues(tenantId, {
          creativeKey: key,
          source: "webhook",
          campaignKey: event.utmCampaign,
        }),
      )
      .onConflictDoUpdate({
        target: [creatives.tenantId, creatives.creativeKey],
        set: { campaignKey: sql`coalesce(${creatives.campaignKey}, ${event.utmCampaign})` },
      })
      .returning({ id: creatives.id });
    const campaignKey = event.utmCampaign?.trim() || "";
    // Counts and money are observed only once a settled (approved, refunded or
    // chargeback) event exists for the day; pending/cancelled/failed alone stay NULL.
    const totals =
      await tx.execute(sql`WITH s AS (SELECT status, revenue_cents, profit_cents FROM sales_events WHERE ${tenantWhere(salesEvents, tenantId)} AND coalesce(creative_key,utm_content)=${key} AND coalesce(nullif(btrim(utm_campaign),''),'')=${campaignKey} AND (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date=${day}::date AND status in ('approved','refunded','chargeback'))
 SELECT CASE WHEN count(*)>0 THEN count(*) FILTER(WHERE status='approved')::text END sales,
 CASE WHEN count(*)>0 THEN count(*) FILTER(WHERE status='refunded')::text END refunds,
 CASE WHEN count(*)>0 THEN count(*) FILTER(WHERE status='chargeback')::text END chargebacks,
 CASE WHEN count(*)=0 OR count(*) FILTER(WHERE revenue_cents IS NULL)>0 THEN NULL ELSE sum(CASE WHEN status='approved' THEN revenue_cents ELSE -revenue_cents END)::text END revenue,
 CASE WHEN count(*)=0 OR count(*) FILTER(WHERE profit_cents IS NULL)>0 THEN NULL ELSE sum(CASE WHEN status='approved' THEN profit_cents ELSE -profit_cents END)::text END profit
 FROM s`);
    const t = totalsSchema.parse(totals.rows[0]);
    await upsertCreativeMetrics(tx, [
      tenantValues(tenantId, {
        creativeId: creative.id,
        campaignKey,
        periodFrom: day,
        periodTo: day,
        source: "webhook",
        confidence: "observed",
        approvedSales: nullableBigint(t.sales),
        refunds: nullableBigint(t.refunds),
        chargebacks: nullableBigint(t.chargebacks),
        revenueCents: nullableBigint(t.revenue),
        profitCents: nullableBigint(t.profit),
      }),
    ]);
  });
}
