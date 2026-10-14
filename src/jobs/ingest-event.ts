import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { salesEvents, creatives, creativeMetrics } from "@/db/schema";
export const eventJobSchema = z
  .object({ tenantId: z.uuid(), eventId: z.uuid() })
  .strict();
export async function ingestEvent(data: unknown) {
  const { tenantId, eventId } = eventJobSchema.parse(data);
  const [event] = await db
    .select()
    .from(salesEvents)
    .where(
      and(eq(salesEvents.tenantId, tenantId), eq(salesEvents.id, eventId)),
    );
  if (!event) return;
  const key = event.creativeKey || event.utmContent;
  if (!key) return;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(event.occurredAt);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},2))`,
    );
    const [creative] = await tx
      .insert(creatives)
      .values({
        tenantId,
        creativeKey: key,
        source: "webhook",
        campaignKey: event.utmCampaign,
      })
      .onConflictDoUpdate({
        target: [creatives.tenantId, creatives.creativeKey],
        set: { campaignKey: sql`coalesce(${creatives.campaignKey}, ${event.utmCampaign})` },
      })
      .returning({ id: creatives.id });
    const campaignKey = event.utmCampaign?.trim() || "";
    const totals =
      await tx.execute(sql`SELECT count(*) FILTER(WHERE status='approved')::text sales, count(*) FILTER(WHERE status='refunded')::text refunds,count(*) FILTER(WHERE status='chargeback')::text chargebacks,
 CASE WHEN count(*) FILTER(WHERE status in ('approved','refunded','chargeback'))=0 THEN NULL WHEN count(*) FILTER(WHERE status in ('approved','refunded','chargeback') AND revenue_cents IS NULL)>0 THEN NULL ELSE coalesce(sum(CASE WHEN status='approved' THEN revenue_cents WHEN status in ('refunded','chargeback') THEN -revenue_cents ELSE 0 END),0)::text END revenue,
 CASE WHEN count(*) FILTER(WHERE status in ('approved','refunded','chargeback'))=0 THEN NULL WHEN count(*) FILTER(WHERE status in ('approved','refunded','chargeback') AND profit_cents IS NULL)>0 THEN NULL ELSE coalesce(sum(CASE WHEN status='approved' THEN profit_cents WHEN status in ('refunded','chargeback') THEN -profit_cents ELSE 0 END),0)::text END profit
 FROM sales_events WHERE tenant_id=${tenantId} AND coalesce(creative_key,utm_content)=${key} AND coalesce(nullif(btrim(utm_campaign),''),'')=${campaignKey} AND (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date=${day}::date`);
    const t = totals.rows[0] as {
      sales: string;
      refunds: string;
      chargebacks: string;
      revenue: string | null;
      profit: string | null;
    };
    const values = {
      tenantId,
      creativeId: creative.id,
      campaignKey,
      periodFrom: day,
      periodTo: day,
      source: "webhook",
      confidence: "observed",
      approvedSales: BigInt(t.sales),
      refunds: BigInt(t.refunds),
      chargebacks: BigInt(t.chargebacks),
      revenueCents: t.revenue === null ? null : BigInt(t.revenue),
      profitCents: t.profit === null ? null : BigInt(t.profit),
    };
    await tx
      .insert(creativeMetrics)
      .values(values)
      .onConflictDoUpdate({
        target: [
          creativeMetrics.tenantId,
          creativeMetrics.creativeId,
          creativeMetrics.periodFrom,
          creativeMetrics.periodTo,
          creativeMetrics.source,
          creativeMetrics.campaignKey,
        ],
        set: values,
      });
  });
}
