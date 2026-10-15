import { z } from "zod";
import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { requireTenant, tenantWhere } from "@/lib/tenant";
import { PageHeader } from "@/components/page-header";
import { ContextForm, type ContextFormValues } from "@/components/context-form";

const list = z.array(z.string()).catch([]);

export async function OfferView() {
  const { tenantId } = await requireTenant();
  const [context] = await db
    .select()
    .from(clientContexts)
    .where(tenantWhere(clientContexts, tenantId));
  const initial: ContextFormValues = {
    produtoNome: context?.produtoNome ?? "",
    produto: context?.produto ?? "",
    transformacao: context?.transformacao ?? "",
    mecanismo: context?.mecanismo ?? "",
    publico: context?.publico ?? "",
    tipoFunil: context?.tipoFunil ?? "",
    proximoPassoFunil: context?.proximoPassoFunil ?? "",
    especialistaHandle: context?.especialistaHandle ?? "",
    provasAutorizadas: list.parse(context?.provasAutorizadas),
    objecoes: list.parse(context?.objecoes),
    restricoes: list.parse(context?.restricoes),
    ticketCents: context?.ticketCents?.toString() ?? null,
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha oferta"
        description="O que o Estrategista sabe sobre o seu negócio. Tudo é salvo sozinho e dá para mudar quando quiser."
        className="mx-auto w-full max-w-3xl text-center sm:block [&>div]:mx-auto"
      />
      <ContextForm initial={initial} />
    </div>
  );
}
