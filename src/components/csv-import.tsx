"use client";
import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { api, recentPeriod } from "@/lib/client";
import { metricNames, metricLabels } from "@/lib/connectors/types";
const fields = [
  "creative_key",
  "creative_name",
  "campaign_key",
  "adset_key",
  ...metricNames,
];
export function CsvImport() {
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState(recentPeriod);
  const [decimal, setDecimal] = useState<"comma" | "dot">("comma");
  const [unit, setUnit] = useState<"major" | "cents">("major");
  const [pending, setPending] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          const result = await api(
            "/api/metrics/import",
            z.object({ imported: z.number() }),
            {
              csv,
              mapping: Object.fromEntries(
                Object.entries(mapping).filter(([, v]) => v),
              ),
              from: period.from,
              to: period.to,
              decimal,
              moneyUnit: unit,
              metricDefinitions: Object.fromEntries(
                Object.entries(definitions).filter(
                  ([key, value]) => mapping[key] && value.trim(),
                ),
              ),
            },
          );
          toast.success(`${result.imported} criativos importados.`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao importar.");
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        Selecione um CSV com uma linha por criativo no mesmo período. Métricas
        ausentes permanecem indisponíveis. Uma nova importação do mesmo período
        substitui os valores; períodos sobrepostos são rejeitados.
      </p>
      <Input
        type="file"
        accept=".csv,text/csv"
        aria-label="Arquivo CSV"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5_000_000) {
            toast.error("Limite de 5 MB.");
            return;
          }
          const text = await file.text();
          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
          });
          if (parsed.errors.length) {
            toast.error("CSV inválido.");
            return;
          }
          const columns = parsed.meta.fields ?? [];
          setCsv(text);
          setHeaders(columns);
          setMapping(
            Object.fromEntries(
              fields.filter((f) => columns.includes(f)).map((f) => [f, f]),
            ),
          );
        }}
      />
      {headers.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`csv-${field}`}>
                  {field in metricLabels
                    ? metricLabels[field as keyof typeof metricLabels]
                    : {
                        creative_key: "Chave do criativo",
                        creative_name: "Nome",
                        campaign_key: "Chave da campanha",
                        adset_key: "Chave do conjunto",
                      }[field]}
                  {field === "creative_key" ? " (obrigatório)" : ""}
                </Label>
                <NativeSelect
                  id={`csv-${field}`}
                  className="w-full"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [field]: e.target.value })
                  }
                >
                  <NativeSelectOption value="">
                    Não disponível
                  </NativeSelectOption>
                  {headers.map((h) => (
                    <NativeSelectOption key={h} value={h}>
                      {h}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
          {(["hook_rate", "body_rate"] as const)
            .filter((metric) => mapping[metric])
            .map((metric) => (
              <div key={metric}>
                <Label htmlFor={`formula-${metric}`}>
                  Fórmula de {metricLabels[metric]} (numerador, denominador e
                  escala)
                </Label>
                <Input
                  id={`formula-${metric}`}
                  required
                  minLength={5}
                  maxLength={500}
                  value={definitions[metric] ?? ""}
                  onInput={(e) =>
                    setDefinitions({
                      ...definitions,
                      [metric]: e.currentTarget.value,
                    })
                  }
                />
              </div>
            ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="csv-from">Início do período</Label>
              <Input
                id="csv-from"
                type="date"
                value={period.from}
                onInput={(e) =>
                  setPeriod({ ...period, from: e.currentTarget.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="csv-to">Fim do período</Label>
              <Input
                id="csv-to"
                type="date"
                value={period.to}
                onInput={(e) =>
                  setPeriod({ ...period, to: e.currentTarget.value })
                }
              />
            </div>
            <NativeSelect
              aria-label="Formato decimal"
              value={decimal}
              onChange={(e) => setDecimal(e.target.value as "comma" | "dot")}
            >
              <NativeSelectOption value="comma">
                Decimal com vírgula (1.234,56)
              </NativeSelectOption>
              <NativeSelectOption value="dot">
                Decimal com ponto (1234.56)
              </NativeSelectOption>
            </NativeSelect>
            <NativeSelect
              aria-label="Unidade monetária"
              value={unit}
              onChange={(e) => setUnit(e.target.value as "major" | "cents")}
            >
              <NativeSelectOption value="major">
                Valores monetários em reais
              </NativeSelectOption>
              <NativeSelectOption value="cents">
                Valores monetários em centavos
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <p className="text-xs text-muted-foreground">
            Moeda BRL. CTR, Hook Rate e Body Rate devem usar a mesma definição e
            escala em todas as linhas. Não envie símbolos de moeda ou %. Use a
            coluna spend_cents para gasto e as demais indicadas no mapeamento.
          </p>
          <Button type="submit" disabled={pending || !mapping.creative_key}>
            {pending ? "Importando…" : "Importar métricas"}
          </Button>
        </>
      )}
    </form>
  );
}
