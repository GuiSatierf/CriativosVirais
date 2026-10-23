"use client";
import Link from "next/link";
import { CircleAlert, FileUp, RotateCw, FileSpreadsheet, TriangleAlert } from "@/components/icons";
import { z } from "zod";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  ImportPeriodNotice,
  isOutsideImports,
  type ImportPeriod,
} from "@/components/metrics/import-period-notice";
import {
  CardMetrics,
  DataTable,
  type DataColumn,
} from "@/components/metrics/data-table";
import { MetricGlossary } from "@/components/metrics/metric-glossary";
import { metricText, type MetricName } from "@/components/metrics/metric-labels";
import { MetricSummary } from "@/components/metrics/metric-summary";
import { MetricValue } from "@/components/metrics/metric-value";
import { MetricsLoading } from "@/components/metrics/metrics-loading";
import {
  MetricsFilter,
  type MetricsFilters,
} from "@/components/metrics/metrics-filter";
import { useMetricsQuery } from "@/components/metrics/use-metrics-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMetric, recentPeriod } from "@/lib/client";
import { aggregatedMetricsSchema, metricNames } from "@/lib/connectors/types";

const schema = z.object({
  warning: z.string().nullable(),
  items: z.array(
    z.object({
      creativeKey: z.string(),
      metrics: aggregatedMetricsSchema.nullable(),
    }),
  ),
});
type Item = z.infer<typeof schema>["items"][number];

const mainMetrics: MetricName[] = [
  "spend_cents",
  "revenue_cents",
  "roas",
  "approved_sales",
  "ctr",
];

const metricColumn = (name: MetricName): DataColumn<Item> => ({
  id: name,
  header: metricText[name].label,
  numeric: true,
  hasValue: (item) =>
    item.metrics?.[name] !== null && item.metrics?.[name] !== undefined,
  render: (item) => <MetricValue name={name} value={item.metrics?.[name]} />,
});
const extraMetrics = metricNames.filter((name) => !mainMetrics.includes(name));
const optionalColumns = extraMetrics.map(metricColumn);

function cardMetric(name: MetricName, item: Item) {
  const value = item.metrics?.[name];
  return {
    label: metricText[name].label,
    value: value === null || value === undefined ? null : formatMetric(name, value),
  };
}

/** Code chip plus the script idea, as shown in the table and the cards. */
function ScriptName({
  item,
  name,
  showMissing = false,
}: {
  item: Item;
  name?: string;
  showMissing?: boolean;
}) {
  return (
    <div className="flex max-w-72 min-w-40 flex-col gap-1">
      <span className="inline-flex w-fit items-center rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-medium">
        {item.creativeKey}
      </span>
      {name && (
        <span className="truncate text-sm" title={name}>
          {name}
        </span>
      )}
      {showMissing && !item.metrics && (
        <span className="text-xs text-muted-foreground">
          Sem resultados neste período
        </span>
      )}
    </div>
  );
}

export function BatchResults({
  batchId,
  defaultFilters,
  names = {},
  showSource = false,
  csvPeriods = [],
}: {
  batchId: string;
  defaultFilters?: MetricsFilters;
  /** Offer the "Planilha | Vendas do checkout" switch (tenant has webhook data). */
  showSource?: boolean;
  /** Script idea per creative key, shown under the code. */
  names?: Record<string, string>;
  /** Latest CSV import periods; a spreadsheet only answers for its exact period. */
  csvPeriods?: ImportPeriod[];
}) {
  const [initialFilters] = useState<MetricsFilters>(
    () => defaultFilters ?? recentPeriod(),
  );
  const query = useMetricsQuery({
    endpoint: `/api/batches/${batchId}/results`,
    schema,
    initialFilters,
  });
  // Remounts the filter toolbar when a period is applied from outside it.
  const [filterVersion, setFilterVersion] = useState(0);
  const { data, loading, error } = query;
  const items = data?.items ?? [];
  const withResults = items.filter((item) => item.metrics !== null).length;
  // Only the latest imports are offered, so an older imported period is
  // recognised by its results rather than by the offered list.
  const outsideImports =
    !loading && withResults === 0 && isOutsideImports(query.filters, csvPeriods);

  function showImportedPeriod(period: ImportPeriod) {
    query.load({ ...query.filters, from: period.from, to: period.to });
    setFilterVersion((version) => version + 1);
  }

  const columns: DataColumn<Item>[] = [
    {
      id: "creative_key",
      header: "Roteiro",
      render: (item) => (
        <ScriptName item={item} name={names[item.creativeKey]} showMissing />
      ),
    },
    ...mainMetrics.map(metricColumn),
  ];

  return (
    <section className="space-y-6" aria-labelledby="batch-results-title">
      <h2 id="batch-results-title" className="sr-only">
        Resultados desta leva
      </h2>
      <MetricsFilter
        key={filterVersion}
        idPrefix="results"
        defaultValue={query.filters}
        pending={loading}
        onChange={query.load}
        onRefresh={query.refresh}
        showSource={showSource}
      />

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Não foi possível carregar os resultados</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={query.refresh}>
              <RotateCw aria-hidden />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <MetricsLoading label="Carregando resultados" />
      ) : outsideImports ? (
        <ImportPeriodNotice periods={csvPeriods} onSelect={showImportedPeriod} />
      ) : withResults === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Ainda sem resultados nesta leva"
          description="Use o código de cada roteiro como nome do anúncio e no utm_content do link. Depois importe a planilha do mesmo período."
          action={
            <Link className={buttonVariants()} href="/integracoes">
              <FileUp aria-hidden />
              Importar planilha
            </Link>
          }
        />
      ) : (
        <>
          {data.warning && (
            <Alert role="status" className="border-warning/40 text-warning">
              <TriangleAlert aria-hidden />
              <AlertDescription className="text-warning">
                {data.warning}
              </AlertDescription>
            </Alert>
          )}

          <MetricSummary
            unit={["roteiro", "roteiros"]}
            rows={items.map((item) => ({
              key: item.creativeKey,
              metrics: item.metrics,
            }))}
          />

          <DataTable
            label="Resultados por roteiro"
            busy={loading}
            summary={`${withResults} de ${items.length} ${items.length === 1 ? "roteiro" : "roteiros"} com resultados`}
            columns={columns}
            optional={optionalColumns}
            rows={items}
            rowKey={(item) => item.creativeKey}
            renderCard={(item) => (
              <div className="space-y-3">
                <ScriptName item={item} name={names[item.creativeKey]} />
                <CardMetrics
                  items={mainMetrics.map((name) => cardMetric(name, item))}
                  more={extraMetrics.map((name) => cardMetric(name, item))}
                />
              </div>
            )}
          />

          <MetricGlossary />
        </>
      )}
    </section>
  );
}
