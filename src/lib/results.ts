import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { getBatch } from "./batches";
import { periodSchema } from "./connectors/types";
import { HttpError } from "./errors";
import { c, m, campaignFilter, metricAggregates, metricWindow } from "./metrics";
import { tenantWhere } from "./tenant-scope";

// Totals stay exact decimal strings; rates are numbers.
function aggregates() {
  const a = metricAggregates();
  const text = (e: SQL) => sql<string | null>`(${e})::text`;
  const rate = (e: SQL) => sql<number | null>`(${e})::float8`;
  return {
    spend_cents: text(a.spend_cents),
    revenue_cents: text(a.revenue_cents),
    profit_cents: text(a.profit_cents),
    approved_sales: text(a.approved_sales),
    impressions: text(a.impressions),
    clicks: text(a.clicks),
    ctr: rate(a.ctr),
    roas: rate(a.roas),
    checkouts: text(a.checkouts),
    leads: text(a.leads),
    refunds: text(a.refunds),
    chargebacks: text(a.chargebacks),
    hook_rate: rate(a.hook_rate),
    body_rate: rate(a.body_rate),
  };
}
export async function getBatchResults(
  tenantId: string,
  batchId: string,
  input: unknown,
) {
  const p = periodSchema.parse(input);
  const batch = await getBatch(tenantId, batchId);
  if (!batch) throw new HttpError(404, "Leva não encontrada.");
  const keys = batch.items.map((item) => item.creativeKey);
  const records = keys.length
    ? await db
        .select({ creativeKey: c.creativeKey, ...aggregates() })
        .from(c)
        .innerJoin(m, and(eq(m.tenantId, c.tenantId), eq(m.creativeId, c.id)))
        .where(
          and(
            tenantWhere(c, tenantId),
            tenantWhere(m, tenantId),
            inArray(c.creativeKey, keys),
            metricWindow(p),
            campaignFilter(p),
          ),
        )
        .groupBy(c.id, c.creativeKey)
    : [];
  const byKey = new Map(records.map(({ creativeKey, ...metrics }) => [creativeKey, metrics]));
  const items = batch.items.map((item) => ({
    creativeKey: item.creativeKey,
    hipotese: item.hipotese,
    blocoTestado: item.blocoTestado,
    metrics: byKey.get(item.creativeKey) ?? null,
  }));
  return {
    batchId,
    period: p,
    items,
    warning: items.every((i) => i.metrics === null)
      ? "Nenhum resultado atribuído às chaves desta leva neste período e fonte."
      : null,
  };
}
