"use client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { api, recentPeriod, formatCents } from "@/lib/client";
import { aggregatedMetricsSchema, metricNames, metricLabels } from "@/lib/connectors/types";
const schema = z.object({
  warning: z.string().nullable(),
  items: z.array(
    z.object({ creativeKey: z.string(), metrics: aggregatedMetricsSchema.nullable() }),
  ),
});
export function BatchResults({ batchId }: { batchId: string }) {
  const [period, setPeriod] = useState(recentPeriod);
  const [campaign, setCampaign] = useState("");
  const [results, setResults] = useState<z.infer<typeof schema>>();
  const [pending, setPending] = useState(false);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Resultados desta leva</h2>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            setResults(
              await api(
                `/api/batches/${batchId}/results?${new URLSearchParams({ ...period, ...(campaign.trim() ? { campaignKey: campaign.trim() } : {}) })}`,
                schema,
              ),
            );
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao consultar.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Input
          type="date"
          aria-label="Início dos resultados"
          className="w-auto"
          value={period.from}
          onInput={(e) => setPeriod({ ...period, from: e.currentTarget.value })}
        />
        <Input
          type="date"
          aria-label="Fim dos resultados"
          className="w-auto"
          value={period.to}
          onInput={(e) => setPeriod({ ...period, to: e.currentTarget.value })}
        />
        <Input
          aria-label="Campanha dos resultados"
          placeholder="Campanha (opcional)"
          className="w-auto"
          value={campaign}
          onInput={(event) => setCampaign(event.currentTarget.value)}
        />
        <NativeSelect
          aria-label="Fonte dos resultados"
          value={period.source}
          onChange={(e) =>
            setPeriod({
              ...period,
              source: e.target.value as "csv" | "webhook",
            })
          }
        >
          <NativeSelectOption value="csv">
            CSV (período exato)
          </NativeSelectOption>
          <NativeSelectOption value="webhook">Webhook</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" disabled={pending}>
          Consultar
        </Button>
      </form>
      {results?.warning && (
        <p className="text-sm text-muted-foreground">{results.warning}</p>
      )}
      {results?.items.map((item) => (
        <div key={item.creativeKey} className="rounded-md border p-3 text-sm">
          <strong>{item.creativeKey}</strong>
          {item.metrics ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metricNames.map((name) => {
                const value = item.metrics![name];
                return (
                  <div key={name}>
                    <dt className="text-muted-foreground">{metricLabels[name]}</dt>
                    <dd>{name.endsWith("_cents")
                      ? formatCents(value === null ? null : String(value))
                      : value === null ? "Não disponível"
                      : typeof value === "number" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
                      : BigInt(value).toLocaleString("pt-BR")}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Resultados não disponíveis neste período e fonte.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
