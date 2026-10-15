import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeMetrics, integrations } from "@/db/schema";
import { tenantWhere } from "./tenant-scope";

/**
 * Whether the tenant has checkout (webhook) data or a connected webhook, so
 * the metrics screens only offer the source switch when it can matter.
 */
export async function hasWebhookSource(tenantId: string) {
  const [metric, integration] = await Promise.all([
    db
      .select({ id: creativeMetrics.id })
      .from(creativeMetrics)
      .where(
        tenantWhere(creativeMetrics, tenantId, eq(creativeMetrics.source, "webhook")),
      )
      .limit(1),
    db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        tenantWhere(
          integrations,
          tenantId,
          eq(integrations.provider, "webhook"),
          eq(integrations.status, "connected"),
        ),
      )
      .limit(1),
  ]);
  return metric.length > 0 || integration.length > 0;
}
