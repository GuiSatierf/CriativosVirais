import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatives, creativeMetrics, integrations } from "@/db/schema";
import { DomainError } from "../errors";
import { nullableBigint, upsertCreativeMetrics } from "../metrics";
import { tenantValues, tenantWhere } from "../tenant-scope";
import { metricNames, type MetricRecord } from "./types";

type MetricName = (typeof metricNames)[number];

// Column of each metric in creative_metrics, so a partial import writes only what it brought.
function metricValues(r: MetricRecord, metrics: readonly MetricName[]) {
  const all = {
    spend_cents: { spendCents: nullableBigint(r.spend_cents) },
    impressions: { impressions: nullableBigint(r.impressions) },
    clicks: { clicks: nullableBigint(r.clicks) },
    ctr: { ctr: r.ctr },
    hook_rate: { hookRate: r.hook_rate },
    body_rate: { bodyRate: r.body_rate },
    leads: { leads: nullableBigint(r.leads) },
    checkouts: { checkouts: nullableBigint(r.checkouts) },
    approved_sales: { approvedSales: nullableBigint(r.approved_sales) },
    revenue_cents: { revenueCents: nullableBigint(r.revenue_cents) },
    profit_cents: { profitCents: nullableBigint(r.profit_cents) },
    roas: { roas: r.roas },
    refunds: { refunds: nullableBigint(r.refunds) },
    chargebacks: { chargebacks: nullableBigint(r.chargebacks) },
  } satisfies Record<MetricName, object>;
  return Object.assign({}, ...metrics.map((metric) => all[metric]));
}

type Snapshot = {
  id: string;
  from: string;
  to: string;
  campaign: string;
  source: string;
};
const chunkSize = 500;
function chunks<T>(items: Iterable<T>) {
  const list = [...items];
  return Array.from({ length: Math.ceil(list.length / chunkSize) }, (_, i) =>
    list.slice(i * chunkSize, (i + 1) * chunkSize),
  );
}
const identity = (key: string, s: Omit<Snapshot, "id">) =>
  JSON.stringify([key, s.from, s.to, s.source, s.campaign]);

/**
 * Saves snapshots. Re-importing a period replaces only the metrics in `metrics` (the columns the
 * file mapped); the others keep what an earlier import of that period brought.
 */
export async function saveMetrics(
  tenantId: string,
  records: MetricRecord[],
  definitions: Record<string, string> = {},
  metrics: readonly MetricName[] = metricNames,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},2))`,
    );
    const [previous] = await tx
      .select({ metadata: integrations.metadata })
      .from(integrations)
      .where(tenantWhere(integrations, tenantId, eq(integrations.provider, "csv")));
    const savedDefinitions =
      (previous?.metadata as { metricDefinitions?: Record<string, string> } | null)
        ?.metricDefinitions ?? {};
    for (const [metric, formula] of Object.entries(definitions))
      if (savedDefinitions[metric] && savedDefinitions[metric] !== formula)
        throw new DomainError(
          "invalid_input",
          "A fórmula desta métrica difere da importação anterior. Use a mesma definição para manter comparações válidas.",
        );
    const combined = { ...savedDefinitions, ...definitions };

    const known = new Map<string, { id: string; campaignKey: string | null }>();
    for (const part of chunks(new Set(records.map((r) => r.creative_key))))
      for (const row of await tx
        .select({ id: creatives.id, key: creatives.creativeKey, campaignKey: creatives.campaignKey })
        .from(creatives)
        .where(tenantWhere(creatives, tenantId, inArray(creatives.creativeKey, part))))
        known.set(row.key, row);
    const keyById = new Map([...known].map(([key, c]) => [c.id, key]));
    const history = new Map<string, Snapshot[]>();
    for (const part of chunks(keyById.keys()))
      for (const row of await tx
        .select({
          id: creativeMetrics.id,
          creativeId: creativeMetrics.creativeId,
          from: creativeMetrics.periodFrom,
          to: creativeMetrics.periodTo,
          campaign: creativeMetrics.campaignKey,
          source: creativeMetrics.source,
        })
        .from(creativeMetrics)
        .where(tenantWhere(creativeMetrics, tenantId, inArray(creativeMetrics.creativeId, part)))) {
        const key = keyById.get(row.creativeId)!;
        history.set(key, [...(history.get(key) ?? []), row]);
      }

    // Rules replay in file order, so each row sees the rows imported before it.
    const campaignOf = new Map([...known].map(([key, c]) => [key, c.campaignKey]));
    const metadata = new Map<string, { name: string | null; campaignKey: string | null; adsetKey: string | null; source: string }>();
    const removed = new Set<string>();
    const pending = new Map<string, { record: MetricRecord; campaignKey: string }>();
    let created = 0;
    for (const r of records) {
      const meta = metadata.get(r.creative_key);
      metadata.set(r.creative_key, {
        name: r.creative_name ?? meta?.name ?? null,
        campaignKey: r.campaign_key ?? meta?.campaignKey ?? null,
        adsetKey: r.adset_key ?? meta?.adsetKey ?? null,
        source: meta?.source ?? r.source,
      });
      const currentCampaign = r.campaign_key ?? campaignOf.get(r.creative_key) ?? null;
      campaignOf.set(r.creative_key, currentCampaign);
      const snapshots = history.get(r.creative_key) ?? [];
      history.set(r.creative_key, snapshots);
      // Reject overlapping snapshots from the same source to avoid double counting different windows.
      const sameSource = snapshots.filter((row) => row.source === r.source);
      const knownCampaigns = new Set(snapshots.map((row) => row.campaign).filter(Boolean));
      if (currentCampaign) knownCampaigns.add(currentCampaign);
      if (!r.campaign_key && knownCampaigns.size > 1)
        throw new DomainError("invalid_input", "Informe a campanha: este criativo tem resultados em mais de uma campanha.");
      const campaignKey = r.campaign_key || [...knownCampaigns][0] || "";
      // A campaign-less snapshot may cover multiple campaigns; do not add it to
      // campaign-specific snapshots. An exact reimport can replace an unknown row.
      const replaceUnknown = sameSource.find((row) => !row.campaign && campaignKey &&
        row.from === r.period_from && row.to === r.period_to);
      if (
        sameSource.some(
          (e) =>
            e.id !== replaceUnknown?.id &&
            e.from <= r.period_to && e.to >= r.period_from &&
            (e.campaign === campaignKey || !e.campaign || !campaignKey) &&
            (e.from !== r.period_from || e.to !== r.period_to || e.campaign !== campaignKey),
        )
      )
        throw new DomainError(
          "invalid_input",
          "Já existe um período sobreposto. Importe o mesmo período para substituir ou use períodos separados.",
        );
      if (replaceUnknown) {
        snapshots.splice(snapshots.indexOf(replaceUnknown), 1);
        pending.delete(identity(r.creative_key, replaceUnknown));
        if (!replaceUnknown.id.startsWith("new:")) removed.add(replaceUnknown.id);
      }
      const snapshot = { from: r.period_from, to: r.period_to, source: r.source, campaign: campaignKey };
      const id = identity(r.creative_key, snapshot);
      if (!snapshots.some((row) => identity(r.creative_key, row) === id))
        snapshots.push({ id: `new:${created++}`, ...snapshot });
      pending.set(id, { record: r, campaignKey });
    }

    const ids = new Map<string, string>();
    for (const part of chunks(metadata))
      for (const row of await tx
        .insert(creatives)
        .values(part.map(([creativeKey, meta]) => tenantValues(tenantId, { creativeKey, ...meta })))
        .onConflictDoUpdate({
          target: [creatives.tenantId, creatives.creativeKey],
          set: {
            name: sql`coalesce(excluded.name, ${creatives.name})`,
            campaignKey: sql`coalesce(excluded.campaign_key, ${creatives.campaignKey})`,
            adsetKey: sql`coalesce(excluded.adset_key, ${creatives.adsetKey})`,
          },
        })
        .returning({ id: creatives.id, key: creatives.creativeKey }))
        ids.set(row.key, row.id);
    for (const part of chunks(removed))
      await tx
        .delete(creativeMetrics)
        .where(tenantWhere(creativeMetrics, tenantId, inArray(creativeMetrics.id, part)));
    for (const part of chunks(pending.values()))
      await upsertCreativeMetrics(
        tx,
        part.map(({ record: r, campaignKey }) =>
          tenantValues(tenantId, {
            creativeId: ids.get(r.creative_key)!,
            campaignKey,
            periodFrom: r.period_from,
            periodTo: r.period_to,
            source: r.source,
            confidence: r.confidence,
            ...metricValues(r, metrics),
          }),
        ),
      );
    if (records.some((r) => r.source === "csv"))
      await tx
        .insert(integrations)
        .values(
          tenantValues(tenantId, {
            provider: "csv" as const,
            status: "connected",
            metadata: { metricDefinitions: combined },
          }),
        )
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.provider],
          set: {
            status: "connected",
            metadata: { metricDefinitions: combined },
          },
        });
    // Distinct creatives, not rows: one creative across several campaigns counts once.
    return new Set(records.map((r) => r.creative_key)).size;
  });
}
