import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batches } from "@/db/schema";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { tenantWhere } from "@/lib/tenant-scope";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.archived !== undefined);

/** Levas are renamed or archived, never deleted: their codes may be live in ads. */
export function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = z.uuid().safeParse((await context.params).id);
    if (!id.success) throw new HttpError(404, "Leva não encontrada.");
    const input = await readJson(request, patchSchema);
    const [row] = await db
      .update(batches)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.archived !== undefined && {
          archivedAt: input.archived ? new Date() : null,
        }),
      })
      .where(tenantWhere(batches, tenantId, eq(batches.id, id.data)))
      .returning({ id: batches.id });
    if (!row) throw new HttpError(404, "Leva não encontrada.");
    return json({ saved: true });
  });
}
