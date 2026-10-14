import { z } from "zod";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getBatch } from "@/lib/batches";
import { batchText, creativeText } from "@/lib/export";
import { CopyButton } from "@/components/copy-button";
import { BatchResults } from "@/components/batch-results";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export default async function Page({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { tenantId } = await requireTenant();
  const id = z.uuid().safeParse((await params).batchId);
  if (!id.success) notFound();
  const batch = await getBatch(tenantId, id.data);
  if (!batch) notFound();
  return (
    <div className="space-y-8 break-words">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{batch.title}</h1>
        <p>{batch.produtoNome}</p>
        {batch.especialistaHandle && (
          <p>@{batch.especialistaHandle.replace(/^@/, "")}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <CopyButton label="Copiar leva inteira" text={batchText(batch)} />
          <a
            className="rounded-md border px-3 py-2 text-sm underline"
            href={`/api/export/batch/${batch.id}`}
          >
            Exportar .docx
          </a>
        </div>
      </header>
      {batch.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                <Badge>{item.creativeKey}</Badge>
              </CardTitle>
              <CopyButton label="Copiar criativo" text={creativeText(item)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Use esta chave como utm_content para atribuir seus resultados.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="mb-3 font-semibold">INSTRUÇÕES</h2>
              <dl className="space-y-2 text-sm">
                {[
                  ["Ideia", item.ideia],
                  ["Formato", item.formato],
                  ["Referência", item.referencia],
                  ["Instruções gravação", item.instrucoesGravacao],
                  ["Instruções edição", item.instrucoesEdicao],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium">{label}:</dt>
                    <dd className="whitespace-pre-wrap">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h2 className="mb-3 font-semibold">HOOK</h2>
              {[item.g1, item.g2, item.g3].map((hook, i) => (
                <p key={i} className="mb-3 whitespace-pre-wrap text-sm">
                  <strong>G{i + 1}: </strong>
                  {hook}
                </p>
              ))}
            </section>
            <section>
              <h2 className="mb-3 font-semibold">CORPO</h2>
              <p className="whitespace-pre-wrap text-sm">{item.corpo}</p>
            </section>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Detalhes do teste
              </summary>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Narrativa", item.narrativa],
                  ["Consciência de entrada", item.awarenessEntry],
                  ["Consciência de saída", item.awarenessExit],
                  ["Esqueleto", item.skeleton],
                  ["Hipótese", item.hipotese],
                  ["Bloco testado", item.blocoTestado],
                  ["Prova", item.provaUsada],
                  ["Duração estimada", `${item.duracaoEstimada}s`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </CardContent>
        </Card>
      ))}
      <BatchResults batchId={batch.id} />
    </div>
  );
}
