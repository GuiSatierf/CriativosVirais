import Papa from "papaparse";
import { z } from "zod";
import {
  recordSchema,
  metricNames,
  floatNames,
  centsNames,
  day,
  type MetricRecord,
} from "./types";
export const csvImportSchema = z
  .object({
    csv: z.string().min(1).max(5_000_000),
    mapping: z.record(z.string(), z.string().max(300)),
    from: day,
    to: day,
    decimal: z.enum(["comma", "dot"]),
    moneyUnit: z.enum(["major", "cents"]),
    metricDefinitions: z
      .object({
        hook_rate: z.string().trim().min(5).max(500).optional(),
        body_rate: z.string().trim().min(5).max(500).optional(),
      })
      .default({}),
  })
  .refine((v) => v.from <= v.to);
export type CsvInput = z.input<typeof csvImportSchema>;
function numeric(
  raw: string,
  decimal: "comma" | "dot",
  money = false,
  major = false,
): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (decimal === "comma") {
    if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(v))
      throw new Error("Número inválido");
    v = v.replaceAll(".", "").replace(",", ".");
  } else if (!/^-?\d+(?:\.\d+)?$/.test(v)) throw new Error("Número inválido");
  if (money && major) {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(v))
      throw new Error("Máximo duas casas para moeda");
    const negative = v.startsWith("-");
    const [a, b = ""] = v.replace(/^-/, "").split(".");
    return (
      (BigInt(a) * 100n + BigInt(b.padEnd(2, "0"))) *
      (negative ? -1n : 1n)
    ).toString();
  }
  return v;
}
export function parseCsv(input: CsvInput): MetricRecord[] {
  const p = csvImportSchema.parse(input);
  for (const metric of ["hook_rate", "body_rate"] as const)
    if (p.mapping[metric] && !p.metricDefinitions[metric])
      throw new Error(`Informe a fórmula de ${metric} antes de importar.`);
  const parsed = Papa.parse<Record<string, string>>(p.csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
  });
  if (
    parsed.meta.renamedHeaders &&
    Object.keys(parsed.meta.renamedHeaders).length
  )
    throw new Error("Colunas repetidas no CSV.");
  if (
    parsed.errors.length ||
    !parsed.meta.fields?.length ||
    parsed.data.length > 5000
  )
    throw new Error("CSV inválido, colunas repetidas ou acima de 5000 linhas.");
  if (
    !p.mapping.creative_key ||
    !parsed.meta.fields.includes(p.mapping.creative_key)
  )
    throw new Error("Mapeie uma chave estável de criativo.");
  for (const header of Object.values(p.mapping))
    if (header && !parsed.meta.fields.includes(header))
      throw new Error("Coluna não encontrada.");
  const seen = new Set<string>();
  return parsed.data.map((row, index) => {
    const read = (field: string) =>
      p.mapping[field] ? (row[p.mapping[field]]?.trim() ?? "") : "";
    const base: Record<string, unknown> = {
      creative_key: read("creative_key"),
      creative_name: read("creative_name") || null,
      campaign_key: read("campaign_key") || null,
      adset_key: read("adset_key") || null,
      period_from: p.from,
      period_to: p.to,
      source: "csv",
      confidence: "observed",
    };
    for (const metric of metricNames) {
      const value = numeric(
        read(metric),
        p.decimal,
        centsNames.some((m) => m === metric),
        p.moneyUnit === "major",
      );
      base[metric] =
        floatNames.some((m) => m === metric) && value !== null
          ? Number(value)
          : value;
    }
    const result = recordSchema.safeParse(base);
    if (!result.success)
      throw new Error(`Linha ${index + 2}: chave, data ou métrica inválida.`);
    const r = result.data;
    if (seen.has(r.creative_key))
      throw new Error(
        `Linha ${index + 2}: chave repetida no período. Consolide as linhas antes de importar.`,
      );
    seen.add(r.creative_key);
    for (const metric of metricNames)
      if (
        metric !== "profit_cents" &&
        r[metric] !== null &&
        Number(r[metric]) < 0
      )
        throw new Error(`Linha ${index + 2}: métrica negativa.`);
    return r;
  });
}
