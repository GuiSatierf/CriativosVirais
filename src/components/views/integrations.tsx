import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import { creativeMetrics, integrations } from "@/db/schema";
import { requireTenant, tenantWhere } from "@/lib/tenant";
import { PageHeader } from "@/components/page-header";
import { Integrations } from "@/components/integrations";

export async function IntegrationsView() {
  const { tenantId } = await requireTenant();
  const [rows, [csv]] = await Promise.all([
    // Same public columns as GET /api/integrations; credentials never leave the server.
    db
      .select({
        provider: integrations.provider,
        status: integrations.status,
        lastSyncAt: integrations.lastSyncAt,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(tenantWhere(integrations, tenantId)),
    // Imports keep no timestamp, so the card shows the last day covered by CSV data.
    db
      .select({ lastDay: max(creativeMetrics.periodTo) })
      .from(creativeMetrics)
      .where(
        tenantWhere(
          creativeMetrics,
          tenantId,
          eq(creativeMetrics.source, "csv"),
        ),
      ),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Traga vendas e investimento para os seus relatórios."
      />
      <Integrations
        initialCsvDay={csv?.lastDay ?? null}
        initialRows={rows.map((row) => ({
          ...row,
          lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
