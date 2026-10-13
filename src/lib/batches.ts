import { and, eq, sql } from "drizzle-orm";
import { generateObject } from "ai";
import { db } from "@/db";
import { batches, batchItems, clientContexts } from "@/db/schema";
import { batchSchema, batchItemSchema } from "./ai/schemas";
import { textModel, providerOptions } from "./ai/model";
import { buildSystemPrompt, untrusted } from "./ai/system-prompt";
import { z } from "zod";
const qualitySchema = z.object({
  checks: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        passed: z.boolean(),
        issues: z.array(z.string().max(1000)).max(20),
      }),
    )
    .max(12),
});
async function quality(
  items: z.infer<typeof batchItemSchema>[],
  system: string,
) {
  const { object } = await generateObject({
    model: textModel(),
    providerOptions,
    schema: qualitySchema,
    maxOutputTokens: 4000,
    system,
    prompt: `Verifique CADA item pelos 15 critérios da seção 26. Falta de prova não autoriza inventar; prova ausente deve estar declarada. Retorne index (base zero), passed e issues para TODOS os itens.\n${untrusted("items", items)}`,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(90_000),
  });
  if (
    object.checks.length !== items.length ||
    new Set(object.checks.map((c) => c.index)).size !== items.length ||
    object.checks.some((c) => c.index >= items.length)
  )
    throw new Error("Incomplete quality check");
  return object.checks;
}
export async function generateBatch(
  tenantId: string,
  conversationId: string,
  quantity: number,
  instructions: string,
) {
  const [context] = await db
    .select()
    .from(clientContexts)
    .where(eq(clientContexts.tenantId, tenantId))
    .limit(1);
  if (
    !context?.produto ||
    !context.publico ||
    !context.transformacao ||
    !context.tipoFunil ||
    !context.proximoPassoFunil ||
    context.ticketCents === null
  )
    throw new Error(
      "Confirme produto, público, transformação, ticket, funil e próximo passo antes de gerar.",
    );
  const system = await buildSystemPrompt(tenantId);
  const { object } = await generateObject({
    model: textModel(),
    providerOptions,
    schema: batchSchema,
    maxOutputTokens: 24000,
    system,
    prompt: `Crie exatamente ${quantity} criativos no template. instrucoes_gravacao e instrucoes_edicao devem ser vazias salvo necessidade real. 3 hooks compatíveis com o mesmo corpo completo falado com CTA. Use somente provas autorizadas. Cada item é uma hipótese explícita.\n${untrusted("generation_request", instructions)}`,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(180_000),
  });
  if (object.items.length !== quantity)
    throw new Error("Unexpected batch size");
  const checks = await quality(object.items, system);
  for (const check of checks.filter((c) => !c.passed)) {
    const regenerated = await generateObject({
      model: textModel(),
      providerOptions,
      schema: batchItemSchema,
      maxOutputTokens: 5000,
      system,
      prompt: `Corrija somente este item pelos critérios de qualidade.\n${untrusted("failed_item", { item: object.items[check.index], issues: check.issues })}`,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(90_000),
    });
    object.items[check.index] = regenerated.object;
    const [verified] = await quality([regenerated.object], system);
    if (!verified.passed)
      throw new Error(
        "A copy não passou na revisão de qualidade. Ajuste o contexto e tente novamente.",
      );
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${tenantId},1))`,
    );
    const count = await tx
      .select({
        round: sql<number>`coalesce(max(${batches.roundNumber}),0)::int`,
      })
      .from(batches)
      .where(eq(batches.tenantId, tenantId));
    const round = count[0].round + 1;
    const month = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    })
      .format(new Date())
      .replace(" de ", "/")
      .toUpperCase();
    const [batch] = await tx
      .insert(batches)
      .values({
        tenantId,
        conversationId,
        title: `LEVA DE CRIATIVOS EM VÍDEO - ${month}`,
        produtoNome: context.produtoNome || context.produto!,
        especialistaHandle: context.especialistaHandle,
        roundNumber: round,
      })
      .returning();
    await tx.insert(batchItems).values(
      object.items.map((i, idx) => ({
        tenantId,
        batchId: batch.id,
        position: idx + 1,
        creativeKey: `L${String(round).padStart(2, "0")}-C${String(idx + 1).padStart(2, "0")}`,
        ideia: i.ideia,
        formato: i.formato,
        referencia: i.referencia,
        instrucoesGravacao: i.instrucoes_gravacao,
        instrucoesEdicao: i.instrucoes_edicao,
        g1: i.g1,
        g2: i.g2,
        g3: i.g3,
        corpo: i.corpo,
        narrativa: i.narrativa,
        awarenessEntry: i.awareness_entry,
        awarenessExit: i.awareness_exit,
        skeleton: i.skeleton,
        hipotese: i.hipotese,
        blocoTestado: i.bloco_testado,
        provaUsada: i.prova_usada,
        duracaoEstimada: i.duracao_estimada,
      })),
    );
    return { id: batch.id, title: batch.title };
  });
}
export async function getBatch(tenantId: string, id: string) {
  const [batch] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.tenantId, tenantId), eq(batches.id, id)))
    .limit(1);
  if (!batch) return null;
  const items = await db
    .select()
    .from(batchItems)
    .where(and(eq(batchItems.tenantId, tenantId), eq(batchItems.batchId, id)))
    .orderBy(batchItems.position);
  return { ...batch, items };
}
