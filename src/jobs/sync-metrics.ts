import { z } from "zod";
import { RetryLaterError } from "@/lib/errors";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { UtmifyConnector, utmifyCredentials } from "@/lib/connectors/utmify";
export const syncJobSchema = z
  .object({ tenantId: z.uuid().optional(), integrationId: z.uuid().optional() })
  .strict()
  .refine((v) => Boolean(v.tenantId) === Boolean(v.integrationId));
export async function syncMetrics(data: unknown) {
  const input = syncJobSchema.parse(data);
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "utmify"),
        input.tenantId ? eq(integrations.tenantId, input.tenantId) : undefined,
        input.integrationId
          ? eq(integrations.id, input.integrationId)
          : undefined,
      ),
    );
  let failed = false;
  for (const row of rows) {
    if (!row.credentialsEncrypted) continue;
    const waiting = z
      .object({ retryAt: z.iso.datetime().optional() })
      .safeParse(row.metadata);
    if (
      waiting.success &&
      waiting.data.retryAt &&
      Date.parse(waiting.data.retryAt) > Date.now()
    ) {
      failed = true;
      continue;
    }
    const where = and(
      eq(integrations.tenantId, row.tenantId),
      eq(integrations.id, row.id),
      eq(integrations.credentialsEncrypted, row.credentialsEncrypted),
      row.lastSyncAt ? eq(integrations.lastSyncAt, row.lastSyncAt) : isNull(integrations.lastSyncAt),
    );
    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
      const from = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(Date.now() - 30 * 86400000));
      const credentials = utmifyCredentials.parse(
        JSON.parse(decrypt(row.credentialsEncrypted)),
      );
      const result = await new UtmifyConnector(credentials).sync(from, today);
      await db
        .update(integrations)
        .set({ lastSyncAt: new Date(), status: "connected", metadata: result })
        .where(where);
    } catch (error) {
      failed = true;
      await db
        .update(integrations)
        .set({
          status: "error",
          metadata: {
            ...(error instanceof RetryLaterError
              ? { retryAt: error.retryAt }
              : {}),
            warning:
              "Falha na consulta. Verifique chave, dashboard, plano elegível, acesso beta e limite temporário.",
          },
        })
        .where(where);
    }
  }
  if (failed) throw new Error("Metrics sync failed");
}
