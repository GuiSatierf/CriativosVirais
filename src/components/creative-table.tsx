"use client";
import { useState, useMemo } from "react";
import { useTable } from "@tanstack/react-table";
import { z } from "zod";
import { toast } from "sonner";
import { api, recentPeriod, formatCents } from "@/lib/client";
import {
  metricNames,
  metricLabels,
  metricsSchema,
} from "@/lib/connectors/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadArea } from "./upload-area";
const rowSchema = metricsSchema.extend({
  creative_key: z.string(),
  name: z.string().nullable(),
  campaign_key: z.string().nullable(),
  period_from: z.string().nullable(),
  period_to: z.string().nullable(),
  video_status: z.string().nullable(),
});
type Row = z.infer<typeof rowSchema>;
export function CreativeTable() {
  const [period, setPeriod] = useState(recentPeriod);
  const [campaign, setCampaign] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string>();
  const columns = useMemo(
    () => [
      { accessorKey: "creative_key", header: "Criativo" },
      { accessorKey: "campaign_key", header: "Campanha" },
      { accessorKey: "period_from", header: "Período" },
      ...metricNames.map((name) => ({
        accessorKey: name,
        header: metricLabels[name],
      })),
      { accessorKey: "video_status", header: "Vídeo / análise" },
    ],
    [],
  );
  const table = useTable({ features: {}, data: rows, columns });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Criativos e métricas</h1>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            setRows(
              await api(
                `/api/creatives?${new URLSearchParams({ ...period, ...(campaign ? { campaignKey: campaign } : {}) })}`,
                z.array(rowSchema),
              ),
            );
            setLoaded(true);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao consultar.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Input
          aria-label="Início do período"
          type="date"
          className="w-auto"
          value={period.from}
          onInput={(e) => setPeriod({ ...period, from: e.currentTarget.value })}
        />
        <Input
          aria-label="Fim do período"
          type="date"
          className="w-auto"
          value={period.to}
          onInput={(e) => setPeriod({ ...period, to: e.currentTarget.value })}
        />
        <Input
          aria-label="Chave de campanha"
          className="w-auto"
          placeholder="Campanha (opcional)"
          value={campaign}
          onInput={(e) => setCampaign(e.currentTarget.value)}
        />
        <NativeSelect
          aria-label="Fonte das métricas"
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
          <NativeSelectOption value="webhook">
            Webhook (por dia)
          </NativeSelectOption>
        </NativeSelect>
        <Button type="submit" disabled={pending}>
          Consultar
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Compare a mesma fonte, período e campanha. Importações CSV usam o
        período exato; eventos do webhook aparecem por dia. “Não disponível”
        preserva ausência de dados.
      </p>
      {!loaded && (
        <p className="text-sm">
          Escolha o período e consulte. Para trazer dados, importe um CSV ou
          conecte o webhook em Integrações.
        </p>
      )}
      {loaded && rows.length === 0 && <p>Nenhum criativo encontrado.</p>}
      {rows.length > 0 && (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {String(header.column.columnDef.header)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => {
                  const value = cell.getValue();
                  const key = cell.column.id;
                  return (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {key === "creative_key" ? (
                        <Button
                          variant="link"
                          onClick={() => setSelected(row.original.creative_key)}
                        >
                          {String(value)}
                        </Button>
                      ) : key === "period_from" ? (
                        `${row.original.period_from ?? "—"} a ${row.original.period_to ?? "—"}`
                      ) : key === "video_status" ? (
                        ({
                          uploaded: "Aguardando",
                          processing: "Em análise",
                          done: "Pronto",
                          error: "Erro",
                        }[String(value)] ?? "Sem vídeo")
                      ) : key.endsWith("_cents") ? (
                        formatCents(value === null ? null : String(value))
                      ) : value === null || value === undefined ? (
                        "Não disponível"
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {selected && (
        <div className="rounded-md border p-4">
          <UploadArea key={selected} creativeKey={selected} />
        </div>
      )}
    </div>
  );
}
