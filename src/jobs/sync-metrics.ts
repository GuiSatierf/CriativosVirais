import { z } from "zod";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { spDay } from "@/lib/dates";
import { ProviderRejectedError, RetryLaterError } from "@/lib/errors";
import { UtmifyConnector, utmifyCredentials } from "@/lib/connectors/utmify";
import { tenantWhere } from "@/lib/tenant-scope";
const integrationJob = z
  .object({ tenantId: z.uuid(), integrationId: z.uuid() })
  .strict();
export type SyncJob = z.infer<typeof integrationJob>;
// The scheduled job carries no payload and only fans out; each integration syncs in its own job.
export const syncJobSchema = z.union([integrationJob, z.object({}).strict()]);
const waitingSchema = z.object({ retryAt: z.iso.datetime().optional() });

export async function syncMetrics(
  data: unknown,
  enqueue: (job: SyncJob) => Promise<unknown>,
) {
  const input = syncJobSchema.parse(data);
  if (!("tenantId" in input)) {
    const rows = await db
      .select({ tenantId: integrations.tenantId, integrationId: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "utmify"),
          isNotNull(integrations.credentialsEncrypted),
        ),
      );
    for (const row of rows) await enqueue(row);
    return;
  }
  // Ownership is checked here: the integration must belong to the job's tenant.
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      tenantWhere(
        integrations,
        input.tenantId,
        eq(integrations.id, input.integrationId),
        eq(integrations.provider, "utmify"),
      ),
    )
    .limit(1);
  if (!row?.credentialsEncrypted) return;
  const waiting = waitingSchema.safeParse(row.metadata);
  if (waiting.success && waiting.data.retryAt && Date.parse(waiting.data.retryAt) > Date.now())
    return;
  const where = tenantWhere(
    integrations,
    row.tenantId,
    eq(integrations.id, row.id),
    eq(integrations.credentialsEncrypted, row.credentialsEncrypted),
    row.lastSyncAt ? eq(integrations.lastSyncAt, row.lastSyncAt) : isNull(integrations.lastSyncAt),
  );
  try {
    const credentials = utmifyCredentials.parse(
      JSON.parse(decrypt(row.credentialsEncrypted)),
    );
    const result = await new UtmifyConnector(credentials).sync(
      spDay(new Date(Date.now() - 30 * 86400000)),
      spDay(),
    );
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date(), status: "connected", metadata: result })
      .where(where);
  } catch (error) {
    const retryLater = error instanceof RetryLaterError;
    const rejected = error instanceof ProviderRejectedError;
    await db
      .update(integrations)
      .set({
        status: "error",
        metadata: retryLater
          ? { retryAt: error.retryAt, warning: error.message }
          : {
              warning: rejected
                ? error.message
                : "Não foi possível sincronizar com a UTMify. Confira a chave e o ID do dashboard.",
            },
      })
      .where(where);
    // A provider-requested pause is not a failure, and a refusal only changes when the user acts.
    if (!retryLater && !rejected) throw error;
  }
}
