import { StatCard } from "@/components/stat-card";
import { formatMetric } from "@/lib/client";

type SummaryMetrics = {
  spend_cents: string | null;
  revenue_cents: string | null;
  approved_sales: string | null;
};
export type SummaryRow = { key: string; metrics: SummaryMetrics | null };

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/**
 * Sums a column over the rows that reported it; null when none did. A key (one creative across its
 * campaigns, or one day) counts as reported only when every one of its rows has the value, so a
 * blank cell in one campaign still makes the total partial.
 */
export function summaryTotal(rows: SummaryRow[], name: keyof SummaryMetrics) {
  let sum = 0n;
  let anyValue = false;
  const keys = new Set<string>();
  const incomplete = new Set<string>();
  for (const row of rows) {
    keys.add(row.key);
    const value = row.metrics?.[name];
    if (value == null) {
      incomplete.add(row.key);
      continue;
    }
    sum += BigInt(value);
    anyValue = true;
  }
  return { value: anyValue ? sum.toString() : null, reported: [...keys].filter((key) => incomplete.has(key) === false).length };
}

/** Keeps "por R$ 1" small so the Retorno number stays readable in a tile. */
function KpiValue({ text }: { text: string }) {
  const [amount, per] = text.split(" por ");
  if (!per) return text;
  return (
    <>
      {amount}{" "}
      <span className="text-sm font-normal whitespace-nowrap text-muted-foreground">
        por {per}
      </span>
    </>
  );
}

/**
 * KPI row over the rows on screen. Totals only add values the source reported
 * and cards without any value are left out, so missing data never becomes
 * zero. A total that only some rows informed says so in its hint.
 */
export function MetricSummary({
  rows,
  unit = ["criativo", "criativos"],
}: {
  rows: SummaryRow[];
  unit?: [string, string];
}) {
  const withResults = rows.filter((row) => row.metrics !== null);
  const count = new Set(withResults.map((row) => row.key)).size;
  // Only a partial total gets a hint; a complete one speaks for itself.
  const hint = (reported: number) => {
    if (reported >= count) return undefined;
    if (reported === 0) return `Soma parcial de ${plural(count, ...unit)}`;
    return `Soma de ${reported.toLocaleString("pt-BR")} de ${plural(count, ...unit)}`;
  };

  const spend = summaryTotal(withResults, "spend_cents");
  const revenue = summaryTotal(withResults, "revenue_cents");
  const sales = summaryTotal(withResults, "approved_sales");

  // ROAS only over creatives that reported both values, with spend above zero.
  const paired = withResults.filter(
    (row) =>
      row.metrics?.spend_cents != null && row.metrics.revenue_cents != null,
  );
  const pairedSpend = summaryTotal(paired, "spend_cents");
  const pairedRevenue = summaryTotal(paired, "revenue_cents");
  const roas =
    pairedSpend.value !== null &&
    pairedRevenue.value !== null &&
    BigInt(pairedSpend.value) > 0n
      ? Number(
          (BigInt(pairedRevenue.value) * 10000n) / BigInt(pairedSpend.value),
        ) / 10000
      : null;

  const cards = [
    { name: "spend_cents", label: "Investimento", ...spend },
    { name: "revenue_cents", label: "Receita", ...revenue },
    {
      name: "roas",
      label: "Retorno",
      value: roas,
      reported: pairedSpend.reported,
    },
    { name: "approved_sales", label: "Vendas", ...sales },
  ].filter((card) => card.value !== null);
  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.name}
          label={card.label}
          value={<KpiValue text={formatMetric(card.name, card.value)} />}
          hint={hint(card.reported)}
        />
      ))}
    </div>
  );
}
