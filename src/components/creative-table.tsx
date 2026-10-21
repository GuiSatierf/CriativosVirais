"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CircleAlert, Eye, EyeOff, FileUp, RotateCw, Film, Upload } from "@/components/icons";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { UploadArea } from "@/components/upload-area";
import { CreativeActions } from "@/components/creative-actions";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CardMetrics,
  DataTable,
  type DataColumn,
} from "@/components/metrics/data-table";
import { MetricGlossary } from "@/components/metrics/metric-glossary";
import { metricText, type MetricName } from "@/components/metrics/metric-labels";
import { MetricSummary } from "@/components/metrics/metric-summary";
import { MetricValue } from "@/components/metrics/metric-value";
import {
  MetricsFilter,
  metricsQuery,
  type MetricsFilters,
} from "@/components/metrics/metrics-filter";
import {
  creativesResponseSchema,
  type CreativeRow,
  type CreativesResponse,
} from "@/components/metrics/creatives-schema";
import { MetricsLoading } from "@/components/metrics/metrics-loading";
import { formatMetric, formatPeriod } from "@/lib/client";
import { metricNames } from "@/lib/connectors/types";
import { useMetricsQuery } from "@/components/metrics/use-metrics-query";
import { cn } from "@/lib/utils";

const videoStatuses: Record<string, { label: string; dot: string }> = {
  uploaded: { label: "Aguardando análise", dot: "bg-warning" },
  processing: { label: "Em análise", dot: "bg-warning animate-pulse" },
  done: { label: "Analisado", dot: "bg-success" },
  error: { label: "Erro na análise", dot: "bg-destructive" },
};
const noVideo = { label: "Sem vídeo", dot: "bg-muted-foreground/40" };

type ImportPeriod = { from: string; to: string };

function VideoStatus({ status }: { status: string | null }) {
  const config = (status && videoStatuses[status]) || noVideo;
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      <span className={cn("size-2 shrink-0 rounded-full", config.dot)} aria-hidden />
      <span className={cn(!status && "text-muted-foreground")}>
        {config.label}
      </span>
    </span>
  );
}

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-medium">
      {children}
    </span>
  );
}

/** Secondary line: name, plus period/campaign when they set this row apart. */
function rowMeta(row: CreativeRow, filters: MetricsFilters) {
  if (!row.period_from || !row.period_to) return "Sem resultados neste período";
  const parts = [];
  if (row.period_from !== filters.from || row.period_to !== filters.to)
    parts.push(formatPeriod(row.period_from, row.period_to));
  if (row.campaign_key && !filters.campaignKey) parts.push(row.campaign_key);
  return parts.join(" · ");
}

const metricColumn = (name: MetricName): DataColumn<CreativeRow> => ({
  id: name,
  header: metricText[name].label,
  numeric: true,
  hasValue: (row) => row[name] !== null && row[name] !== undefined,
  render: (row) => <MetricValue name={name} value={row[name]} />,
});

const mainMetrics: MetricName[] = [
  "spend_cents",
  "revenue_cents",
  "roas",
  "approved_sales",
  "ctr",
];

const extraMetrics = metricNames.filter((n) => !mainMetrics.includes(n));

function cardMetric(name: MetricName, row: CreativeRow) {
  const value = row[name];
  return {
    label: metricText[name].label,
    value: value === null || value === undefined ? null : formatMetric(name, value),
  };
}

const optionalColumns: DataColumn<CreativeRow>[] = [
  {
    id: "period",
    header: "Período",
    hasValue: (row) => Boolean(row.period_from && row.period_to),
    render: (row) =>
      row.period_from && row.period_to ? (
        formatPeriod(row.period_from, row.period_to)
      ) : (
        <span className="text-muted-foreground">Sem resultados</span>
      ),
  },
  {
    id: "campaign_key",
    header: "Campanha",
    hasValue: (row) => Boolean(row.campaign_key),
    render: (row) =>
      row.campaign_key ?? (
        <span className="text-muted-foreground">Não informada</span>
      ),
  },
  ...extraMetrics.map(metricColumn),
];

function plural(n: number) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "criativo" : "criativos"}`;
}

export function CreativeTable({
  initialFilters,
  initialData,
  showSource = false,
  csvPeriods = [],
}: {
  initialFilters: MetricsFilters;
  initialData?: CreativesResponse;
  /** Offer the "Planilha | Vendas do checkout" switch (tenant has webhook data). */
  showSource?: boolean;
  /** Latest CSV import periods; a spreadsheet only answers for its exact period. */
  csvPeriods?: ImportPeriod[];
}) {
  const query = useMetricsQuery({
    endpoint: "/api/creatives",
    schema: creativesResponseSchema,
    initialFilters,
    initialData,
  });
  const { filters, data, loading, error } = query;
  // The key stays set while the sheet animates closed so the title does not blank.
  const [upload, setUpload] = useState<{ key: string; open: boolean }>();
  const [showHidden, setShowHidden] = useState(false);
  // Remounts the filter toolbar when a period is applied from outside it.
  const [filterVersion, setFilterVersion] = useState(0);

  function applyFilters(next: MetricsFilters) {
    // Keeps the URL shareable and reload-safe without a server round trip.
    window.history.replaceState(null, "", `?${metricsQuery(next)}`);
    setUpload(undefined);
    query.load(next);
  }

  function showImportedPeriod(period: ImportPeriod) {
    applyFilters({ ...filters, from: period.from, to: period.to });
    setFilterVersion((version) => version + 1);
  }

  const outsideImports =
    filters.source === "csv" &&
    csvPeriods.length > 0 &&
    !csvPeriods.some(
      (period) => period.from === filters.from && period.to === filters.to,
    );

  const openUpload = (key: string) => setUpload({ key, open: true });
  const uploadButton = (row: CreativeRow, className?: string) => (
    <Button
      variant="ghost"
      size="xs"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={() => openUpload(row.creative_key)}
    >
      <Upload aria-hidden />
      Enviar vídeo
      <span className="sr-only"> de {row.creative_key}</span>
    </Button>
  );

  const rowActions = (row: CreativeRow, className?: string) => (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {uploadButton(row)}
      <CreativeActions
        creativeKey={row.creative_key}
        hidden={row.hidden}
        hasVideo={row.video_status !== null}
        onChange={query.revalidate}
      />
    </div>
  );

  const columns: DataColumn<CreativeRow>[] = [
    {
      id: "creative_key",
      header: "Criativo",
      render: (row) => {
        const meta = rowMeta(row, filters);
        return (
          <div className="flex max-w-64 min-w-40 flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <KeyChip>{row.creative_key}</KeyChip>
              {row.hidden && <Badge variant="outline">Oculto</Badge>}
            </span>
            {row.name && (
              <span className="truncate text-sm" title={row.name}>
                {row.name}
              </span>
            )}
            {meta && (
              <span className="truncate text-xs text-muted-foreground">
                {meta}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "video_status",
      header: "Vídeo",
      render: (row) => <VideoStatus status={row.video_status} />,
    },
    ...mainMetrics.map(metricColumn),
  ];

  const allRows = data?.rows ?? [];
  const hiddenKeys = new Set(
    allRows.filter((row) => row.hidden).map((row) => row.creative_key),
  ).size;
  const rows = showHidden ? allRows : allRows.filter((row) => !row.hidden);
  const hiddenToggle = hiddenKeys > 0 && (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      aria-pressed={showHidden}
      onClick={() => setShowHidden(!showHidden)}
    >
      {showHidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      {showHidden ? "Esconder ocultos" : `Mostrar ocultos (${hiddenKeys})`}
    </Button>
  );
  const keys = new Set(rows.map((row) => row.creative_key)).size;

  return (
    <div className="space-y-6">
      <MetricsFilter
        key={filterVersion}
        idPrefix="creatives"
        defaultValue={filters}
        pending={loading}
        onChange={applyFilters}
        onRefresh={query.refresh}
        showSource={showSource}
      />

      {outsideImports && (
        <Alert>
          <CalendarDays aria-hidden />
          <AlertTitle>Não há planilha importada para este período</AlertTitle>
          <AlertDescription>
            <p>
              A planilha vale só para as datas em que foi importada. Escolha um
              período importado para ver os resultados.
            </p>
            <div className="flex flex-wrap gap-2">
              {csvPeriods.map((period) => (
                <Button
                  key={`${period.from}|${period.to}`}
                  variant="outline"
                  size="sm"
                  onClick={() => showImportedPeriod(period)}
                >
                  Ver {formatPeriod(period.from, period.to)}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Não foi possível carregar os criativos</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={query.refresh}>
              <RotateCw aria-hidden />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <MetricsLoading label="Carregando criativos" />
      ) : rows.length === 0 && hiddenKeys > 0 ? (
        <EmptyState
          icon={EyeOff}
          title="Todos os criativos estão ocultos"
          description="Mostre os ocultos para vê-los de novo."
          action={hiddenToggle}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Nenhum criativo encontrado"
          description={
            filters.campaignKey
              ? "Nenhum criativo nesta campanha. Tente buscar sem a campanha."
              : "Importe a planilha do Gerenciador de Anúncios para ver os resultados de cada criativo."
          }
          action={
            <Link className={buttonVariants()} href="/integracoes">
              <FileUp aria-hidden />
              Importar planilha
            </Link>
          }
        />
      ) : (
        <>
          <MetricSummary
            rows={rows.map((row) => ({
              key: row.creative_key,
              metrics: row.period_from ? row : null,
            }))}
          />

          <DataTable
            label="Tabela de criativos"
            busy={loading}
            summary={
              <>
                {plural(keys)}
                {hiddenToggle && <> · {hiddenToggle}</>}
                {data.truncated && (
                  <span role="status">
                    {" "}
                    · mostrando os primeiros 1.000. Diminua o período para ver
                    todos.
                  </span>
                )}
              </>
            }
            columns={columns}
            optional={optionalColumns}
            trailing={{
              id: "actions",
              header: "Ações",
              hideHeader: true,
              className: "w-0 text-right",
              render: (row) => rowActions(row),
            }}
            rows={rows}
            rowKey={(row, i) =>
              `${row.creative_key}|${row.period_from}|${row.campaign_key}|${i}`
            }
            renderCard={(row) => {
              // The metrics area already says when there are no results.
              const meta = row.period_from ? rowMeta(row, filters) : "";
              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-1.5">
                        <KeyChip>{row.creative_key}</KeyChip>
                        {row.hidden && <Badge variant="outline">Oculto</Badge>}
                      </span>
                      {row.name && (
                        <span className="truncate text-sm">{row.name}</span>
                      )}
                      {meta && (
                        <span className="truncate text-xs text-muted-foreground">
                          {meta}
                        </span>
                      )}
                    </div>
                    <VideoStatus status={row.video_status} />
                  </div>
                  <CardMetrics
                    items={mainMetrics.map((name) => cardMetric(name, row))}
                    more={extraMetrics.map((name) => cardMetric(name, row))}
                  />
                  {rowActions(row, "-ml-2 justify-start")}
                </div>
              );
            }}
          />

          <MetricGlossary />
        </>
      )}

      <Sheet
        open={upload?.open ?? false}
        onOpenChange={(open) => {
          if (open || !upload) return;
          setUpload({ ...upload, open: false });
          // Refreshes video statuses without clearing the table.
          query.revalidate();
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Enviar vídeo de {upload?.key}</SheetTitle>
            <SheetDescription>
              O vídeo é analisado automaticamente. Pode fechar este painel; a
              análise continua.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {upload && (
              <UploadArea
                key={upload.key}
                creativeKey={upload.key}
                onVideoReady={() => {
                  toast.success(`Vídeo de ${upload.key} analisado.`);
                  setUpload({ ...upload, open: false });
                  query.revalidate();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
