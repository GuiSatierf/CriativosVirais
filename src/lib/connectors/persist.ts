import { HttpError } from "../errors";
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
        throw new HttpError(
          400,
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
            name: sql`coalesce(${r.creative_name}, ${creatives.name})`,
            campaignKey: sql`coalesce(${r.campaign_key}, ${creatives.campaignKey})`,
            adsetKey: sql`coalesce(${r.adset_key}, ${creatives.adsetKey})`,
          },
        })
        .returning({ id: creatives.id, campaignKey: creatives.campaignKey });
      // Reject overlapping snapshots from the same source to avoid double counting different windows.
      const history = await tx
        .select({
          id: creativeMetrics.id,
          from: creativeMetrics.periodFrom,
          to: creativeMetrics.periodTo,
          campaign: creativeMetrics.campaignKey,
          source: creativeMetrics.source,
        })
        .from(creativeMetrics)
        .where(
          and(
            eq(creativeMetrics.tenantId, tenantId),
            eq(creativeMetrics.creativeId, creative.id),
          ),
        );
      const existing = history.filter((row) => row.source === r.source);
      const knownCampaigns = new Set(history.map((row) => row.campaign).filter(Boolean));
      if (creative.campaignKey) knownCampaigns.add(creative.campaignKey);
      if (!r.campaign_key && knownCampaigns.size > 1)
        throw new HttpError(400, "Informe a campanha: este criativo tem resultados em mais de uma campanha.");
      const campaignKey = r.campaign_key || [...knownCampaigns][0] || "";
      // A campaign-less snapshot may cover multiple campaigns; do not add it to
      // campaign-specific snapshots. An exact reimport can replace an unknown row.
      const replaceUnknown = existing.find((row) => !row.campaign && campaignKey &&
        row.from === r.period_from && row.to === r.period_to);
      if (
        existing.some(
          (e) =>
            e.id !== replaceUnknown?.id &&
            e.from <= r.period_to && e.to >= r.period_from &&
            (e.campaign === campaignKey || !e.campaign || !campaignKey) &&
            (e.from !== r.period_from || e.to !== r.period_to || e.campaign !== campaignKey),
        )
      )
        throw new HttpError(
          400,
          "Já existe um período sobreposto. Importe o mesmo período para substituir ou use períodos separados.",
        );
      if (replaceUnknown)
        await tx.delete(creativeMetrics).where(and(eq(creativeMetrics.tenantId, tenantId),
          eq(creativeMetrics.id, replaceUnknown.id)));
      const b = (v: string | null) => (v === null ? null : BigInt(v));
      const values = {
        tenantId,
        creativeId: creative.id,
        campaignKey,
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
            creativeMetrics.campaignKey,
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
