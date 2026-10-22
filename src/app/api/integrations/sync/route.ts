import { eq } from "drizzle-orm";
import { integrations } from "@/db/schema";
import { db } from "@/db";
import { handle, apiTenant, json, HttpError } from "@/lib/http";
import { getJobs, manualSyncOptions } from "@/jobs";
import { tenantWhere } from "@/lib/tenant-scope";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const [row] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(tenantWhere(integrations, tenantId, eq(integrations.provider, "utmify")));
    if (!row) throw new HttpError(404, "Conecte a UTMify primeiro.");
    const jobId = await (
      await getJobs()
    ).send(
      "sync-metrics",
      { tenantId, integrationId: row.id },
      manualSyncOptions(row.id),
    );
    if (jobId === null)
      throw new HttpError(
        429,
        "Você pediu uma sincronização há pouco. Aguarde até 5 minutos para pedir de novo.",
      );
    return json({ queued: true }, 202);
  });
}
