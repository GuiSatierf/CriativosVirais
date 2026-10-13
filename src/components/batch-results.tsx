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
const metrics = z.object({
  approved_sales: z.string().nullable(),
  revenue_cents: z.string().nullable(),
  profit_cents: z.string().nullable(),
  refunds: z.string().nullable(),
  chargebacks: z.string().nullable(),
});
const schema = z.object({
  warning: z.string().nullable(),
  items: z.array(
    z.object({ creativeKey: z.string(), metrics: metrics.nullable() }),
  ),
});
export function BatchResults({ batchId }: { batchId: string }) {
  const [period, setPeriod] = useState(recentPeriod);
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
                `/api/batches/${batchId}/results?${new URLSearchParams(period)}`,
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
            <p className="mt-2">
              Vendas: {item.metrics.approved_sales ?? "Não disponível"} ·
              Receita: {formatCents(item.metrics.revenue_cents)} · Lucro:{" "}
              {formatCents(item.metrics.profit_cents)} · Reembolsos:{" "}
              {item.metrics.refunds ?? "Não disponível"} · Chargebacks:{" "}
              {item.metrics.chargebacks ?? "Não disponível"}
            </p>
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
