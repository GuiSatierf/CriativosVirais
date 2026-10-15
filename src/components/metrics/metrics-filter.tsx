"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, RefreshCw, Search } from "@/components/icons";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type MetricsSource = "csv" | "webhook";
export type MetricsFilters = {
  from: string;
  to: string;
  source: MetricsSource;
  campaignKey?: string;
};

const sourceLabels: Record<MetricsSource, string> = {
  csv: "Planilha",
  webhook: "Vendas do checkout",
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

/** Query string accepted by the metrics endpoints. */
export function metricsQuery(filters: MetricsFilters) {
  const campaignKey = filters.campaignKey?.trim();
  return new URLSearchParams({
    from: filters.from,
    to: filters.to,
    source: filters.source,
    ...(campaignKey ? { campaignKey } : {}),
  }).toString();
}

/**
 * Compact filter toolbar. Changes apply on their own: dates and source right
 * away, the campaign search after a short pause (or on Enter). The source
 * switch only appears when the tenant has checkout (webhook) data.
 */
export function MetricsFilter({
  idPrefix,
  defaultValue,
  pending,
  onChange,
  onRefresh,
  showSource = false,
}: {
  idPrefix: string;
  defaultValue: MetricsFilters;
  pending: boolean;
  onChange: (filters: MetricsFilters) => void;
  onRefresh: () => void;
  showSource?: boolean;
}) {
  const [from, setFrom] = useState(defaultValue.from);
  const [to, setTo] = useState(defaultValue.to);
  const [source, setSource] = useState(defaultValue.source);
  const [campaign, setCampaign] = useState(defaultValue.campaignKey ?? "");
  const applied = useRef(metricsQuery(defaultValue));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const datesValid = dayPattern.test(from) && dayPattern.test(to) && from <= to;
  const id = (name: string) => `${idPrefix}-${name}`;

  function apply(next: {
    from: string;
    to: string;
    source: MetricsSource;
    campaign: string;
  }) {
    clearTimeout(timer.current);
    if (
      !dayPattern.test(next.from) ||
      !dayPattern.test(next.to) ||
      next.from > next.to
    )
      return;
    const campaignKey = next.campaign.trim();
    const filters: MetricsFilters = {
      from: next.from,
      to: next.to,
      source: next.source,
      ...(campaignKey ? { campaignKey } : {}),
    };
    const query = metricsQuery(filters);
    if (query === applied.current) return;
    applied.current = query;
    onChange(filters);
  }
  const current = { from, to, source, campaign };

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Filtros"
        aria-busy={pending}
        className="flex flex-wrap items-center gap-2"
      >
        <div
          role="group"
          aria-label="Período"
          aria-describedby={datesValid ? undefined : id("period-error")}
          className={cn(
            "flex min-h-9 w-full items-center gap-0.5 rounded-lg border border-input bg-card px-1.5 pl-3 transition-[border-color,box-shadow] duration-(--duration-fast) focus-within:border-ring pointer-coarse:min-h-11 sm:w-auto",
            !datesValid &&
              "border-destructive focus-within:ring-destructive/20",
          )}
        >
          <CalendarDays
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <DatePicker
            id={id("from")}
            variant="inline"
            aria-label="Data inicial"
            max={to || undefined}
            invalid={!datesValid}
            className="flex-1 sm:flex-none"
            value={from}
            onChange={(day) => {
              setFrom(day);
              apply({ ...current, from: day });
            }}
          />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <DatePicker
            id={id("to")}
            variant="inline"
            aria-label="Data final"
            min={from || undefined}
            invalid={!datesValid}
            className="flex-1 sm:flex-none"
            value={to}
            onChange={(day) => {
              setTo(day);
              apply({ ...current, to: day });
            }}
          />
        </div>

        {showSource && (
          <ToggleGroup
            aria-label="Origem dos dados"
            aria-describedby={datesValid ? id("source-hint") : undefined}
            variant="outline"
            spacing={0}
            className="bg-card"
            value={[source]}
            onValueChange={(value) => {
              const next = (value as MetricsSource[])[0];
              if (!next) return;
              setSource(next);
              apply({ ...current, source: next });
            }}
          >
            {(Object.keys(sourceLabels) as MetricsSource[]).map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                className="min-h-9 px-3 text-muted-foreground data-pressed:bg-primary data-pressed:text-primary-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/90 pointer-coarse:min-h-11"
              >
                {sourceLabels[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <div className="relative min-w-40 flex-1 sm:w-56 sm:flex-none">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={id("campaign")}
            type="search"
            aria-label="Filtrar por campanha"
            placeholder="Campanha"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            className="pl-9"
            value={campaign}
            onChange={(event) => {
              const value = event.target.value;
              setCampaign(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(
                () => apply({ ...current, campaign: value }),
                400,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply(current);
              }
            }}
          />
        </div>

        <Hint label="Atualizar resultados">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Atualizar resultados"
            disabled={pending}
            onClick={onRefresh}
          >
            <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
          </Button>
        </Hint>
      </div>

      {!datesValid && (
        <p id={id("period-error")} className="text-sm text-destructive">
          Escolha uma data final igual ou depois da inicial.
        </p>
      )}

      {showSource && datesValid && (
        <p id={id("source-hint")} className="text-xs text-muted-foreground">
          Planilha: use o mesmo período da planilha importada. Vendas do
          checkout: soma as vendas de cada dia do período.
        </p>
      )}
    </div>
  );
}
