import { DomainError } from "../errors";
import Papa from "papaparse";
import { z } from "zod";
import {
  recordSchema,
  metricNames,
  floatNames,
  centsNames,
  day,
  metricLabels,
  type MetricRecord,
} from "./types";
export const csvImportSchema = z
  .object({
    csv: z.string().min(1).max(5_000_000)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 5_000_000, "CSV acima de 5 MB."),
    mapping: z.partialRecord(z.enum(["creative_key", "creative_name", "campaign_key", "adset_key", ...metricNames]), z.string().max(300)),
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
const maxRows = 5000;

// A stored ratio goes stale once a re-import replaces one of its inputs, so it is rewritten too.
const ratioInputs = {
  ctr: ["clicks", "impressions"],
  roas: ["spend_cents", "revenue_cents"],
} as const;

/** Metrics the user mapped to a column; the others are left untouched when a period is re-imported. */
export function mappedMetrics(mapping: CsvInput["mapping"]) {
  return metricNames.filter((metric) => {
    if (mapping[metric]) return true;
    if (metric !== "ctr" && metric !== "roas") return false;
    return ratioInputs[metric].some((input) => Boolean(mapping[input]));
  });
}
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
      throw new DomainError("invalid_input", "Número inválido");
    v = v.replaceAll(".", "").replace(",", ".");
  } else if (!/^-?\d+(?:\.\d+)?$/.test(v)) throw new DomainError("invalid_input", "Número inválido");
  if (v.length > 40) throw new DomainError("invalid_input", "Número acima do limite permitido");
  if (money && major) {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(v))
      throw new DomainError("invalid_input", "Máximo duas casas para moeda");
    const negative = v.startsWith("-");
    const [a, b = ""] = v.replace(/^-/, "").split(".");
    return (
      (BigInt(a) * 100n + BigInt(b.padEnd(2, "0"))) *
      (negative ? -1n : 1n)
    ).toString();
  }
  return v;
}
/** Number errors name the spreadsheet row and column, so the user can find the cell. */
function numericAt(index: number, column: string | undefined, parse: () => string | null) {
  try {
    return parse();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    throw new DomainError("invalid_input", `Linha ${index + 2}, coluna "${column ?? ""}": ${error.message.toLowerCase()}.`);
  }
}

export function parseCsv(input: CsvInput): MetricRecord[] {
  const p = csvImportSchema.parse(input);
  for (const metric of ["hook_rate", "body_rate"] as const)
    if (p.mapping[metric] && !p.metricDefinitions[metric])
      throw new DomainError("invalid_input", `Informe a fórmula de ${metricLabels[metric]} antes de importar.`);
  // No `preview` cap: Papa counts skipped blank lines toward it, so a file with blank lines would
  // lose its last rows silently instead of being refused. The 5 MB limit already bounds the parse.
  const parsed = Papa.parse<Record<string, string>>(p.csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
  });
  if (
    parsed.meta.renamedHeaders &&
    Object.keys(parsed.meta.renamedHeaders).length
  )
    throw new DomainError("invalid_input", "Colunas repetidas no CSV.");
  if (
    parsed.errors.length ||
    !parsed.meta.fields?.length ||
    parsed.data.length > maxRows
  )
    throw new DomainError("invalid_input", "CSV inválido, colunas repetidas ou acima de 5000 linhas.");
  if (parsed.data.length === 0)
    throw new DomainError("invalid_input", "A planilha não tem nenhuma linha de dados, só o cabeçalho.");
  if (
    !p.mapping.creative_key ||
    !parsed.meta.fields.includes(p.mapping.creative_key)
  )
    throw new DomainError("invalid_input", "Mapeie uma chave estável de criativo.");
  for (const header of Object.values(p.mapping))
    if (header && !parsed.meta.fields.includes(header))
      throw new DomainError("invalid_input", "Coluna não encontrada.");
  const seen = new Set<string>();
  const campaigns = new Map<string, Set<string | null>>();
  return parsed.data.map((row, index) => {
    const read = (field: keyof typeof p.mapping) =>
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
      const value = numericAt(index, p.mapping[metric], () =>
        numeric(read(metric), p.decimal, centsNames.some((m) => m === metric), p.moneyUnit === "major"),
      );
      base[metric] =
        floatNames.some((m) => m === metric) && value !== null
          ? Number(value)
          : value;
    }
    const result = recordSchema.safeParse(base);
    if (!result.success)
      throw new DomainError("invalid_input", `Linha ${index + 2}: chave, data ou métrica inválida.`);
    const r = result.data;
    const identity = JSON.stringify([r.creative_key, r.campaign_key]);
    if (seen.has(identity))
      throw new DomainError("invalid_input", `Linha ${index + 2}: chave e campanha repetidas no período. Consolide as linhas antes de importar.`,
      );
    const previousCampaigns = campaigns.get(r.creative_key) ?? new Set<string | null>();
    if (previousCampaigns.size && (r.campaign_key === null || previousCampaigns.has(null)))
      throw new DomainError("invalid_input", `Linha ${index + 2}: informe a campanha em todas as linhas deste criativo.`);
    previousCampaigns.add(r.campaign_key);
    campaigns.set(r.creative_key, previousCampaigns);
    seen.add(identity);
    for (const metric of metricNames)
      if (
        metric !== "profit_cents" &&
        r[metric] !== null &&
        Number(r[metric]) < 0
      )
        throw new DomainError("invalid_input", `Linha ${index + 2}: métrica negativa.`);
    return r;
  });
}
