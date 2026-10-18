import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { batchGenerations } from "@/db/schema";
import { handle, apiTenant, json, HttpError } from "@/lib/http";
import { tenantWhere } from "@/lib/tenant-scope";

/** Progress of a batch requested in the chat; the card polls it until the batch is done or failed. */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = z.uuid().parse((await context.params).id);
    const [generation] = await db
      .select({
        status: batchGenerations.status,
        title: batchGenerations.title,
        batchId: batchGenerations.batchId,
      })
      .from(batchGenerations)
      .where(tenantWhere(batchGenerations, tenantId, eq(batchGenerations.id, id)));
    if (!generation) throw new HttpError(404, "Leva não encontrada.");
    return json({
      status: generation.status,
      title: generation.title,
      batchId: generation.status === "done" ? generation.batchId : null,
    });
  });
}
