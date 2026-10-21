"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { z } from "zod";
import { toast } from "sonner";
import { CircleAlert, FileUp, Loader2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { metricText } from "@/components/metrics/metric-labels";
import { Details, Step, Steps } from "@/components/integrations/shared";
import { api, recentPeriod, toastError } from "@/lib/client";
import { metricNames } from "@/lib/connectors/types";
import { cn } from "@/lib/utils";

const fields = [
  "creative_key",
  "creative_name",
  "campaign_key",
  "adset_key",
  ...metricNames,
] as const;
type Field = (typeof fields)[number];

const fieldLabels: Record<Field, string> = {
  creative_key: "Código do criativo",
  creative_name: "Nome do criativo",
  campaign_key: "Campanha",
  adset_key: "Conjunto de anúncios",
  ...(Object.fromEntries(
    metricNames.map((name) => [name, metricText[name].label]),
  ) as Record<(typeof metricNames)[number], string>),
};

/** Shown first; the rest sit behind "Outras colunas". */
const mainFields: Field[] = [
  "creative_key",
  "creative_name",
  "spend_cents",
  "revenue_cents",
  "approved_sales",
  "impressions",
  "clicks",
];
const extraFields = fields.filter((f) => !mainFields.includes(f));

const formulaMetrics = ["hook_rate", "body_rate"] as const;

/**
 * Header guesses, applied in order; each rule fills its field with the first
 * unused header that matches. Specific rules come before generic ones so that
 * "Conjunto de anúncios" is not taken as the creative code.
 */
const guessRules: [Field, RegExp][] = [
  ["creative_key", /utm_?content/],
  ["campaign_key", /campanha|campaign/],
  ["adset_key", /conjunto|adset|ad set|grupo de anuncio/],
  [
    "creative_name",
    /(nome|name).*(criativo|anuncio|creative|\bad\b)|(criativo|anuncio|creative|\bad\b).*(nome|name)/,
  ],
  ["creative_key", /criativo|anuncio|creative|^ads?\b|ad_?id/],
  ["revenue_cents", /receita|faturamento|revenue|valor de conversao/],
  ["profit_cents", /lucro|profit/],
  ["spend_cents", /gasto|investimento|investido|spend|valor usado|^custo$/],
  ["roas", /roas/],
  ["approved_sales", /vendas|compras|sales|purchases/],
  ["impressions", /impress/],
  ["ctr", /ctr/],
  ["clicks", /clique|click/],
  ["hook_rate", /hook/],
  ["body_rate", /body/],
  ["leads", /lead|cadastro/],
  ["checkouts", /checkout|finaliza/],
  ["refunds", /reembolso|refund/],
  ["chargebacks", /chargeback|estorno/],
];

/** Batch codes (L01-C01) at the start of a value: the column the ads were named with. */
const batchCodePattern = /^L\d{2,}-C\d{2,}\b/i;
const sampleSize = 50;

function normalize(header: string) {
  return header.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** A column where most filled values start with a batch code. */
function holdsBatchCodes(column: string, rows: Record<string, string>[]) {
  const values = rows
    .slice(0, sampleSize)
    .map((row) => row[column]?.trim())
    .filter(Boolean);
  if (values.length === 0) return false;
  const codes = values.filter((value) => batchCodePattern.test(value)).length;
  return codes * 2 >= values.length;
}

function guessMapping(columns: string[], rows: Record<string, string>[]) {
  const mapping: Partial<Record<Field, string>> = {};
  const used = new Set<string>();
  const take = (field: Field, column: string | undefined) => {
    if (!column || mapping[field]) return;
    mapping[field] = column;
    used.add(column);
  };
  for (const field of fields)
    take(
      field,
      columns.find((c) => !used.has(c) && normalize(c) === field),
    );
  take(
    "creative_key",
    columns.find((c) => !used.has(c) && holdsBatchCodes(c, rows)),
  );
  for (const [field, rule] of guessRules)
    take(
      field,
      columns.find((c) => !used.has(c) && rule.test(normalize(c))),
    );
  // Ads Manager exports have no code column: the ad name is what identifies each ad.
  if (mapping.creative_key || !mapping.creative_name)
    return mapping as Record<string, string>;
  const { creative_name: adName, ...rest } = mapping;
  return { ...rest, creative_key: adName } as Record<string, string>;
}

function Segmented<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: [T, string, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        spacing={0}
        className="w-full"
        value={[value]}
        onValueChange={(next) => {
          // Keep one option selected; clicking the active one is a no-op.
          if (next[0]) onChange(next[0] as T);
        }}
      >
        {options.map(([option, name, example]) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="h-auto min-h-9 flex-1 flex-col gap-0 py-1.5 pointer-coarse:min-h-11 aria-pressed:bg-muted aria-pressed:text-foreground"
          >
            <span>{name}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {example}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** CSV import as a three-step form, rendered inside the setup Sheet. */
export function CsvImport({
  onImported,
  initialFile,
}: {
  onImported: (to: string) => void;
  /** A file dropped elsewhere (e.g. on the chat) that opens step 1 filled in. */
  initialFile?: File;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState(recentPeriod);
  const [decimal, setDecimal] = useState<"comma" | "dot">("comma");
  const [unit, setUnit] = useState<"major" | "cents">("major");
  const [pending, setPending] = useState(false);
  const [definitions, setDefinitions] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string>();
  const [fileName, setFileName] = useState<string>();

  async function readFile(file: File | undefined) {
    setFileError(undefined);
    setHeaders([]);
    setCsv("");
    setMapping({});
    setFileName(file?.name);
    if (!file) return;
    if (file.size > 5_000_000) {
      setFileError(
        "O arquivo passa de 5 MB. Divida a planilha e tente de novo.",
      );
      return;
    }
    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().replace(/^﻿/, ""),
    });
    const columns = parsed.meta.fields ?? [];
    if (parsed.errors.length || columns.length === 0) {
      setFileError(
        "Não conseguimos ler este arquivo. Confira se é um CSV com cabeçalho na primeira linha.",
      );
      return;
    }
    setCsv(text);
    setHeaders(columns);
    setMapping(guessMapping(columns, parsed.data as Record<string, string>[]));
  }

  const [loadedInitial, setLoadedInitial] = useState<File>();
  if (initialFile && loadedInitial !== initialFile) {
    setLoadedInitial(initialFile);
    void readFile(initialFile);
  }

  const ready = headers.length > 0;
  const guessedExtra = extraFields.some((f) => mapping[f]);

  function fieldRow(field: Field) {
    const required = field === "creative_key";
    return (
      <div
        key={field}
        className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:gap-3"
      >
        <Label htmlFor={`csv-${field}`} className="min-w-0">
          {fieldLabels[field]}
          {required && (
            <span className="font-normal text-muted-foreground">
              (obrigatório)
            </span>
          )}
        </Label>
        <Select
          value={mapping[field] ?? ""}
          items={[
            { value: "", label: "Não disponível" },
            ...headers.map((h) => ({ value: h, label: h })),
          ]}
          onValueChange={(value) => {
            setMapping({ ...mapping, [field]: value ?? "" });
            if (required && value)
              document
                .getElementById(`csv-${field}`)
                ?.removeAttribute("aria-invalid");
          }}
        >
          <SelectTrigger id={`csv-${field}`} aria-required={required || undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não disponível</SelectItem>
            {headers.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      aria-busy={pending}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        // The column select is not a native control, so it is checked here.
        if (ready && !mapping.creative_key) {
          const trigger = document.getElementById("csv-creative_key");
          trigger?.setAttribute("aria-invalid", "true");
          trigger?.focus();
          toast.error("Escolha a coluna com o código do criativo.");
          return;
        }
        const invalid = e.currentTarget.querySelector<HTMLElement>(":invalid");
        if (invalid) {
          invalid.setAttribute("aria-invalid", "true");
          invalid.addEventListener(
            "input",
            () => invalid.removeAttribute("aria-invalid"),
            { once: true },
          );
          invalid.focus();
          toast.error("Preencha os campos obrigatórios destacados.");
          return;
        }
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
          const query = new URLSearchParams({
            from: period.from,
            to: period.to,
            source: "csv",
          });
          toast.success(
            `${result.imported} ${result.imported === 1 ? "criativo importado" : "criativos importados"}.`,
            {
              action: {
                label: "Ver criativos",
                onClick: () => router.push(`/criativos?${query}`),
              },
            },
          );
          onImported(period.to);
        } catch (error) {
          toastError(error, "Não foi possível importar. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex-1 px-6 py-6">
        <Steps>
          <Step number={1} title="Escolha o arquivo" done={ready}>
            {/* The native file control shows browser-language text, so a styled label opens it. */}
            <div className="flex min-w-0 items-center gap-3">
              <input
                id="csv-file"
                className="peer sr-only"
                type="file"
                accept=".csv,text/csv"
                aria-describedby="csv-file-name csv-file-hint"
                aria-invalid={fileError ? true : undefined}
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
              <label
                htmlFor="csv-file"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/70",
                )}
              >
                <FileUp aria-hidden />
                {fileName ? "Trocar arquivo" : "Escolher arquivo"}
              </label>
              <span
                id="csv-file-name"
                className="min-w-0 truncate text-sm text-muted-foreground"
              >
                {fileName ?? "Nenhum arquivo escolhido"}
              </span>
            </div>
            <p id="csv-file-hint" className="text-xs text-muted-foreground">
              CSV de até 5 MB, com os nomes das colunas na primeira linha.
            </p>
            {fileError && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}
          </Step>

          <Step
            number={2}
            title="Diga o que é cada coluna"
            muted={!ready}
            done={ready && Boolean(mapping.creative_key)}
          >
            {ready ? (
              <fieldset className="space-y-3">
                <legend className="sr-only">
                  Qual coluna corresponde a cada dado
                </legend>
                <p className="text-xs text-muted-foreground">
                  Já preenchemos o que reconhecemos; use “Não disponível” se
                  faltar o dado.
                </p>
                <div className="space-y-3">{mainFields.map(fieldRow)}</div>
                <Details
                  label="Outras colunas (opcional)"
                  defaultOpen={guessedExtra}
                >
                  <div className="space-y-3 pt-1">
                    {extraFields.map(fieldRow)}
                  </div>
                </Details>
                {formulaMetrics
                  .filter((metric) => mapping[metric])
                  .map((metric) => (
                    <div key={metric} className="space-y-1.5">
                      <Label htmlFor={`formula-${metric}`}>
                        Fórmula usada para {metricText[metric].label}
                      </Label>
                      <Input
                        id={`formula-${metric}`}
                        required
                        minLength={5}
                        maxLength={500}
                        aria-describedby={`formula-${metric}-hint`}
                        value={definitions[metric] ?? ""}
                        onChange={(e) =>
                          setDefinitions({
                            ...definitions,
                            [metric]: e.target.value,
                          })
                        }
                      />
                      <p
                        id={`formula-${metric}-hint`}
                        className="text-xs text-muted-foreground"
                      >
                        Por exemplo: visualizações de 3 segundos ÷ impressões.
                      </p>
                    </div>
                  ))}
              </fieldset>
            ) : (
              <p className="text-xs text-muted-foreground">
                Disponível depois de escolher o arquivo.
              </p>
            )}
          </Step>

          <Step number={3} title="Período e formato" muted={!ready}>
            {ready ? (
              <fieldset className="space-y-4">
                <legend className="sr-only">Período e formato</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="csv-from">Início</Label>
                    <DatePicker
                      id="csv-from"
                      max={period.to}
                      value={period.from}
                      onChange={(day) => setPeriod({ ...period, from: day })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="csv-to">Fim</Label>
                    <DatePicker
                      id="csv-to"
                      min={period.from}
                      value={period.to}
                      onChange={(day) => setPeriod({ ...period, to: day })}
                    />
                  </div>
                </div>
                <Segmented
                  id="csv-decimal"
                  label="Separador de decimais"
                  value={decimal}
                  onChange={setDecimal}
                  options={[
                    ["comma", "Vírgula", "1.234,56"],
                    ["dot", "Ponto", "1234.56"],
                  ]}
                />
                <Segmented
                  id="csv-unit"
                  label="Valores em dinheiro"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    ["major", "Em reais", "12,50"],
                    ["cents", "Em centavos", "1250"],
                  ]}
                />
                <Details label="Regras da importação">
                  <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
                    <li>Valores em reais (BRL), sem “R$” e sem “%”.</li>
                    <li>
                      Cada taxa (cliques, retenção) deve seguir a mesma fórmula
                      em todas as linhas.
                    </li>
                    <li>
                      Reimportar o mesmo período substitui os valores; períodos
                      sobrepostos a outra importação são recusados.
                    </li>
                  </ul>
                </Details>
              </fieldset>
            ) : (
              <p className="text-xs text-muted-foreground">
                Disponível depois de escolher o arquivo.
              </p>
            )}
          </Step>
        </Steps>
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t bg-background px-6 py-4">
        {ready && !mapping.creative_key && (
          <p className="text-sm text-muted-foreground">
            Escolha a coluna do código do criativo.
          </p>
        )}
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={pending || !ready}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Importando…" : "Importar"}
        </Button>
      </div>
    </form>
  );
}
