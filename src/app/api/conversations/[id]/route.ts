import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, conversations } from "@/db/schema";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { tenantWhere } from "@/lib/tenant-scope";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.archived !== undefined);

async function conversationId(context: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) throw new HttpError(404, "Conversa não encontrada.");
  return id.data;
}

export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = await conversationId(context);
    const input = await readJson(request, patchSchema);
    const [row] = await db
      .update(conversations)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.archived !== undefined && {
          archivedAt: input.archived ? new Date() : null,
        }),
      })
      .where(tenantWhere(conversations, tenantId, eq(conversations.id, id)))
      .returning({ id: conversations.id });
    if (!row) throw new HttpError(404, "Conversa não encontrada.");
    return json({ saved: true });
  });
}

/** Levas cascade from their conversation, so only conversations without levas are deleted. */
export function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = await conversationId(context);
    return db.transaction(async (tx) => {
      const [batch] = await tx
        .select({ id: batches.id })
        .from(batches)
        .where(tenantWhere(batches, tenantId, eq(batches.conversationId, id)))
        .limit(1)
        .for("share");
      if (batch)
        throw new HttpError(
          409,
          "Esta conversa gerou levas e não pode ser excluída. Arquive-a para tirá-la da lista.",
        );
      const [row] = await tx
        .delete(conversations)
        .where(tenantWhere(conversations, tenantId, eq(conversations.id, id)))
        .returning({ id: conversations.id });
      if (!row) throw new HttpError(404, "Conversa não encontrada.");
      return json({ deleted: true });
    });
  });
}
