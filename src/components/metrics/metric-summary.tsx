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

/** Sums a column over the rows that reported it; null when none did. */
function total(rows: SummaryRow[], name: keyof SummaryMetrics) {
  let sum = 0n;
  const keys = new Set<string>();
  for (const row of rows) {
    const value = row.metrics?.[name];
    if (value === null || value === undefined) continue;
    sum += BigInt(value);
    keys.add(row.key);
  }
  return { value: keys.size ? sum.toString() : null, reported: keys.size };
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
  const hint = (reported: number) =>
    reported > 0 && reported < count
      ? `Soma de ${reported.toLocaleString("pt-BR")} de ${plural(count, ...unit)}`
      : undefined;

  const spend = total(withResults, "spend_cents");
  const revenue = total(withResults, "revenue_cents");
  const sales = total(withResults, "approved_sales");

  // ROAS only over creatives that reported both values, with spend above zero.
  const paired = withResults.filter(
    (row) =>
      row.metrics?.spend_cents != null && row.metrics.revenue_cents != null,
  );
  const pairedSpend = total(paired, "spend_cents");
  const pairedRevenue = total(paired, "revenue_cents");
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
