import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatives, creativeMetrics, integrations } from "@/db/schema";
import { recordSchema, type MetricRecord } from "./types";
export async function saveMetrics(
  tenantId: string,
  records: MetricRecord[],
  definitions: Record<string, string> = {},
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},2))`,
    );
    const [previous] = await tx
      .select({ metadata: integrations.metadata })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "csv"),
        ),
      );
    const existing =
      (
        previous?.metadata as {
          metricDefinitions?: Record<string, string>;
        } | null
      )?.metricDefinitions ?? {};
    for (const [metric, formula] of Object.entries(definitions))
      if (existing[metric] && existing[metric] !== formula)
        throw new Error(
          "A fórmula desta métrica difere da importação anterior. Use a mesma definição para manter comparações válidas.",
        );
    const combined = { ...existing, ...definitions };
    for (const input of records) {
      const r = recordSchema.parse(input);
      const [creative] = await tx
        .insert(creatives)
        .values({
          tenantId,
          creativeKey: r.creative_key,
          name: r.creative_name,
          campaignKey: r.campaign_key,
          adsetKey: r.adset_key,
          source: r.source,
        })
        .onConflictDoUpdate({
          target: [creatives.tenantId, creatives.creativeKey],
          set: {
            name: r.creative_name,
            campaignKey: r.campaign_key,
            adsetKey: r.adset_key,
          },
        })
        .returning({ id: creatives.id });
      // Reject overlapping snapshots from the same source to avoid double counting different windows.
      const existing = await tx
        .select({
          id: creativeMetrics.id,
          from: creativeMetrics.periodFrom,
          to: creativeMetrics.periodTo,
        })
        .from(creativeMetrics)
        .where(
          and(
            eq(creativeMetrics.tenantId, tenantId),
            eq(creativeMetrics.creativeId, creative.id),
            eq(creativeMetrics.source, r.source),
          ),
        );
      if (
        existing.some(
          (e) =>
            e.from <= r.period_to &&
            e.to >= r.period_from &&
            (e.from !== r.period_from || e.to !== r.period_to),
        )
      )
        throw new Error(
          "Já existe um período sobreposto. Importe o mesmo período para substituir ou use períodos separados.",
        );
      const b = (v: string | null) => (v === null ? null : BigInt(v));
      const values = {
        tenantId,
        creativeId: creative.id,
        periodFrom: r.period_from,
        periodTo: r.period_to,
        source: r.source,
        confidence: r.confidence,
        spendCents: b(r.spend_cents),
        impressions: b(r.impressions),
        clicks: b(r.clicks),
        ctr: r.ctr,
        hookRate: r.hook_rate,
        bodyRate: r.body_rate,
        leads: b(r.leads),
        checkouts: b(r.checkouts),
        approvedSales: b(r.approved_sales),
        revenueCents: b(r.revenue_cents),
        profitCents: b(r.profit_cents),
        roas: r.roas,
        refunds: b(r.refunds),
        chargebacks: b(r.chargebacks),
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
          ],
          set: values,
        });
    }
    if (records.some((r) => r.source === "csv"))
      await tx
        .insert(integrations)
        .values({
          tenantId,
          provider: "csv",
          status: "connected",
          metadata: { metricDefinitions: combined },
        })
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.provider],
          set: {
            status: "connected",
            metadata: { metricDefinitions: combined },
          },
        });
    return records.length;
  });
}
