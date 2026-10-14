import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatives, creativeMetrics } from "@/db/schema";
import { getBatch } from "./batches";
import { periodSchema } from "./connectors/types";
import { HttpError } from "./http";
export async function getBatchResults(
  tenantId: string,
  batchId: string,
  input: unknown,
) {
  const p = periodSchema.parse(input);
  const batch = await getBatch(tenantId, batchId);
  if (!batch) throw new HttpError(404, "Leva não encontrada.");
  const records = await db
    .select({ creativeKey: creatives.creativeKey, metrics: creativeMetrics })
    .from(creatives)
    .innerJoin(
      creativeMetrics,
      and(
        eq(creativeMetrics.creativeId, creatives.id),
        eq(creativeMetrics.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(creatives.tenantId, tenantId),
        eq(creativeMetrics.source, p.source),
        p.campaignKey ? eq(creativeMetrics.campaignKey, p.campaignKey) : undefined,
        sql`((${p.source}='csv' AND ${creativeMetrics.periodFrom}=${p.from}::date AND ${creativeMetrics.periodTo}=${p.to}::date) OR (${p.source}='webhook' AND ${creativeMetrics.periodFrom}>=${p.from}::date AND ${creativeMetrics.periodTo}<=${p.to}::date))`,
      ),
    );
  const items = batch.items.map((item) => {
    const rows = records
      .filter((r) => r.creativeKey === item.creativeKey)
      .map((r) => r.metrics);
    const sum = (
      key:
        | "spendCents"
        | "revenueCents"
        | "profitCents"
        | "approvedSales"
        | "impressions"
        | "checkouts"
        | "clicks"
        | "leads"
        | "refunds"
        | "chargebacks",
    ) =>
      !rows.length || rows.some((r) => r[key] === null)
        ? null
        : rows.reduce((n, r) => n + r[key]!, 0n).toString();
    const impressions = sum("impressions");
    const clicks = sum("clicks");
    const spend = sum("spendCents");
    const revenue = sum("revenueCents");
    const ctr = impressions !== null && clicks !== null && BigInt(impressions) > 0n
      ? 100 * Number(clicks) / Number(impressions)
      : rows.length === 1 ? rows[0].ctr : null;
    const roas = spend !== null && revenue !== null && BigInt(spend) > 0n
      ? Number(revenue) / Number(spend)
      : rows.length === 1 ? rows[0].roas : null;
    return {
      creativeKey: item.creativeKey,
      hipotese: item.hipotese,
      blocoTestado: item.blocoTestado,
      metrics: rows.length
        ? {
            spend_cents: sum("spendCents"),
            revenue_cents: sum("revenueCents"),
            profit_cents: sum("profitCents"),
            approved_sales: sum("approvedSales"),
            impressions,
            clicks,
            ctr,
            roas,
            checkouts: sum("checkouts"),
            leads: sum("leads"),
            refunds: sum("refunds"),
            chargebacks: sum("chargebacks"),
            hook_rate: rows.length === 1 ? rows[0].hookRate : null,
            body_rate: rows.length === 1 ? rows[0].bodyRate : null,
          }
        : null,
    };
  });
  return {
    batchId,
    period: p,
    items,
    warning: items.every((i) => i.metrics === null)
      ? "Nenhum resultado atribuído às chaves desta leva neste período e fonte."
      : null,
  };
}
