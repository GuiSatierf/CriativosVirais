import { z } from "zod";
export const metricNames = [
  "spend_cents",
  "impressions",
  "clicks",
  "ctr",
  "hook_rate",
  "body_rate",
  "leads",
  "checkouts",
  "approved_sales",
  "revenue_cents",
  "profit_cents",
  "roas",
  "refunds",
  "chargebacks",
] as const;
export const centsNames = [
  "spend_cents",
  "revenue_cents",
  "profit_cents",
] as const;
export const floatNames = ["ctr", "hook_rate", "body_rate", "roas"] as const;
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
// A single refinement: Zod 4 keeps running later checks after a failed regex,
// so the pattern must guard the BigInt conversion itself.
const integer = z
  .string()
  .refine(
    (v) =>
      /^-?\d{1,19}$/.test(v) &&
      BigInt(v) >= -9223372036854775808n &&
      BigInt(v) <= 9223372036854775807n,
  )
  .nullable();
export const metricsSchema = z.object({
  spend_cents: integer,
  impressions: integer,
  clicks: integer,
  ctr: z.number().nullable(),
  hook_rate: z.number().nullable(),
  body_rate: z.number().nullable(),
  leads: integer,
  checkouts: integer,
  approved_sales: integer,
  revenue_cents: integer,
  profit_cents: integer,
  roas: z.number().nullable(),
  refunds: integer,
  chargebacks: integer,
});
// Aggregates can exceed a single PostgreSQL bigint while remaining exact text.
const aggregatedInteger = z.string().max(40).regex(/^-?\d+$/).nullable();
export const aggregatedMetricsSchema = metricsSchema.extend({
  spend_cents: aggregatedInteger,
  impressions: aggregatedInteger,
  clicks: aggregatedInteger,
  leads: aggregatedInteger,
  checkouts: aggregatedInteger,
  approved_sales: aggregatedInteger,
  revenue_cents: aggregatedInteger,
  profit_cents: aggregatedInteger,
  refunds: aggregatedInteger,
  chargebacks: aggregatedInteger,
});
export const recordSchema = metricsSchema
  .extend({
    creative_key: z.string().trim().min(1).max(200),
    creative_name: z.string().max(300).nullable(),
    campaign_key: z.string().trim().min(1).max(200).nullable(),
    adset_key: z.string().max(200).nullable(),
    period_from: day,
    period_to: day,
    source: z.enum(["csv", "webhook", "utmify"]),
    confidence: z.string().max(100),
  })
  .refine((v) => v.period_from <= v.period_to, "Período inválido");
export type MetricRecord = z.infer<typeof recordSchema>;
export const periodSchema = z
  .object({
    from: day,
    to: day,
    source: z.enum(["csv", "webhook"]).default("csv"),
    campaignKey: z.string().trim().min(1).max(200).optional(),
  })
  .refine((v) => v.from <= v.to, "Período inválido");
export const attributionWarning =
  "Não encontramos uma chave confiável ligando vendas aos criativos. Podemos analisar os vídeos, mas não atribuir automaticamente o resultado por criativo.";

export const metricLabels: Record<(typeof metricNames)[number], string> = {
  spend_cents: "Gasto",
  impressions: "Impressões",
  clicks: "Cliques",
  ctr: "CTR",
  hook_rate: "Hook Rate",
  body_rate: "Body Rate",
  leads: "Leads",
  checkouts: "Checkouts",
  approved_sales: "Vendas aprovadas",
  revenue_cents: "Receita",
  profit_cents: "Lucro",
  roas: "ROAS",
  refunds: "Reembolsos",
  chargebacks: "Chargebacks",
};
