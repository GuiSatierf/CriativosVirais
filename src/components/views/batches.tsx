import Link from "next/link";
import { desc, isNotNull, isNull, sql } from "drizzle-orm";
import { Archive, ArrowLeft, ArrowRight, Layers, Plus } from "@/components/icons";
import { db } from "@/db";
import { batches } from "@/db/schema";
import { requireTenant, tenantWhere } from "@/lib/tenant";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function BatchesView({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const archived = (await searchParams).arquivadas === "1";
  const rows = await db
    .select({
      id: batches.id,
      title: batches.title,
      product: batches.produtoNome,
      round: batches.roundNumber,
      createdAt: batches.createdAt,
      scripts: sql<number>`(SELECT count(*)::int FROM batch_items bi
        WHERE bi.tenant_id = "batches"."tenant_id"
          AND bi.batch_id = "batches"."id")`,
      // Cheap existence check so the list can flag levas with imported results.
      // Drizzle leaves columns unqualified inside select expressions, so the
      // correlated subquery names its tables explicitly.
      hasResults: sql<boolean>`EXISTS (SELECT 1 FROM batch_items bi
        JOIN creatives c ON c.tenant_id = bi.tenant_id
          AND c.creative_key = bi.creative_key
        JOIN creative_metrics cm ON cm.tenant_id = c.tenant_id
          AND cm.creative_id = c.id
        WHERE bi.tenant_id = "batches"."tenant_id"
          AND bi.batch_id = "batches"."id")`,
    })
    .from(batches)
    .where(
      tenantWhere(
        batches,
        tenantId,
        archived ? isNotNull(batches.archivedAt) : isNull(batches.archivedAt),
      ),
    )
    .orderBy(desc(batches.createdAt));
  return (
    <div className="space-y-6">
      <PageHeader
        title={archived ? "Levas arquivadas" : "Levas"}
        description={
          archived
            ? "Levas fora da lista principal. Abra uma leva para restaurá-la."
            : "Cada leva é um conjunto de roteiros para testar de uma vez."
        }
        actions={
          archived ? (
            <Link className={buttonVariants({ variant: "outline" })} href="/levas">
              <ArrowLeft aria-hidden />
              Voltar para levas
            </Link>
          ) : (
            <>
              <Link
                className={buttonVariants({ variant: "ghost" })}
                href="/levas?arquivadas=1"
              >
                <Archive aria-hidden />
                Arquivadas
              </Link>
              {rows.length > 0 && (
                <Link className={buttonVariants()} href="/chat">
                  <Plus aria-hidden />
                  Gerar nova leva
                </Link>
              )}
            </>
          )
        }
      />
      {rows.length === 0 && archived ? (
        <EmptyState
          icon={Archive}
          title="Nenhuma leva arquivada"
          description="Arquive uma leva pelo menu dela para tirá-la da lista principal."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhuma leva ainda"
          description="Peça a primeira na conversa: o Estrategista monta os roteiros a partir da sua oferta."
          action={
            <Link className={buttonVariants()} href="/chat">
              <Plus aria-hidden />
              Gerar a primeira leva
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((batch) => (
            <li key={batch.id} className="flex">
              <Link
                href={`/levas/${batch.id}`}
                className="group flex w-full flex-col rounded-xl border bg-card p-5 outline-none transition-[border-color,transform] duration-(--duration-fast) ease-(--ease-interface) hover:-translate-y-0.5 hover:border-foreground/20 active:translate-y-0 active:border-foreground/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 space-y-1">
                    <span className="block truncate text-base font-semibold tracking-tight">
                      {batch.title}
                    </span>
                    {!batch.title.includes(batch.product) && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {batch.product}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-[color,transform] duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                </span>
                <span className="mt-4 mb-4 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">Rodada {batch.round}</Badge>
                  {batch.hasResults && (
                    <Badge
                      variant="outline"
                      className="border-success/40 text-success"
                    >
                      <span
                        className="size-1.5 rounded-full bg-success"
                        aria-hidden
                      />
                      Com resultados
                    </Badge>
                  )}
                </span>
                <span className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {batch.scripts}{" "}
                    {batch.scripts === 1 ? "roteiro" : "roteiros"}
                  </span>
                  <time dateTime={batch.createdAt.toISOString()}>
                    {formatDate(batch.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
