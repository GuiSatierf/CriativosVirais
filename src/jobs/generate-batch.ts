import { z } from "zod";
import { eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { batchGenerations } from "@/db/schema";
import { generateBatch } from "@/lib/batches";
import { generationTimeoutMs, latestGenerationStart } from "@/lib/batch-generation-status";
import { DomainError } from "@/lib/errors";
import { logError } from "@/lib/log";
import { tenantWhere } from "@/lib/tenant-scope";

export const generationJobSchema = z
  .object({ tenantId: z.uuid(), generationId: z.uuid() })
  .strict();

function updateGeneration(
  tenantId: string,
  generationId: string,
  values: Partial<typeof batchGenerations.$inferInsert>,
) {
  return db
    .update(batchGenerations)
    .set(values)
    .where(tenantWhere(batchGenerations, tenantId, eq(batchGenerations.id, generationId)));
}

/**
 * Worker handler: generates the batch requested in the chat. Failures are recorded on the
 * generation (the chat card shows them) and not rethrown, so the model is never paid twice.
 */
export async function runBatchGeneration(data: unknown) {
  const { tenantId, generationId } = generationJobSchema.parse(data);
  // The tenant check and the queued→running claim happen in one statement. A generation that
  // waited too long is not started: the chat card would give up on it before it could finish.
  const [generation] = await db
    .update(batchGenerations)
    .set({ status: "running" })
    .where(
      tenantWhere(
        batchGenerations,
        tenantId,
        eq(batchGenerations.id, generationId),
        eq(batchGenerations.status, "queued"),
        gt(batchGenerations.createdAt, latestGenerationStart()),
      ),
    )
    .returning();
  if (!generation) {
    await db
      .update(batchGenerations)
      .set({ status: "failed" })
      .where(
        tenantWhere(
          batchGenerations,
          tenantId,
          eq(batchGenerations.id, generationId),
          eq(batchGenerations.status, "queued"),
        ),
      );
    return;
  }
  try {
    const batch = await generateBatch(
      tenantId,
      generation.conversationId,
      generation.quantity,
      generation.instructions,
      AbortSignal.timeout(generationTimeoutMs),
    );
    await updateGeneration(tenantId, generationId, { status: "done", batchId: batch.id, title: batch.title });
  } catch (error) {
    logError("generate-batch", error);
    await updateGeneration(tenantId, generationId, {
      status: "failed",
      error: error instanceof DomainError ? error.message : null,
    });
  }
}
