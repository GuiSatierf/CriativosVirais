import { PageHeader } from "@/components/page-header";
import { CreativeTable } from "@/components/creative-table";
import {
  creativesResponseSchema,
  type CreativesResponse,
} from "@/components/metrics/creatives-schema";
import type { MetricsFilters } from "@/components/metrics/metrics-filter";
import { periodSchema } from "@/lib/connectors/types";
import { getCreatives } from "@/lib/creatives";
import { defaultMetricsPeriod } from "@/lib/default-period";
import { hasWebhookSource } from "@/lib/metric-sources";
import { requireTenant } from "@/lib/tenant";

export async function CreativesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await requireTenant();
  const params = await searchParams;
  const [fallback, showSource]: [MetricsFilters, boolean] = await Promise.all([
    defaultMetricsPeriod(tenantId),
    hasWebhookSource(tenantId),
  ]);
  const requested = periodSchema.safeParse({
    from: params.from ?? fallback.from,
    to: params.to ?? fallback.to,
    source: params.source ?? fallback.source,
    campaignKey: params.campaignKey || undefined,
  });
  const parsed: MetricsFilters = requested.success ? requested.data : fallback;
  // Without checkout data there is no switch, so the spreadsheet is the only source.
  const filters: MetricsFilters = showSource
    ? parsed
    : { ...parsed, source: "csv" };
  let initialData: CreativesResponse | undefined;
  try {
    // Same query as GET /api/creatives; the client refetches if this fails.
    initialData = creativesResponseSchema.parse(
      JSON.parse(JSON.stringify(await getCreatives(tenantId, filters))),
    );
  } catch {
    initialData = undefined;
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados"
        description="Como cada criativo performou no período escolhido."
      />
      <CreativeTable
        key={`${filters.from}|${filters.to}|${filters.source}|${filters.campaignKey ?? ""}`}
        initialFilters={filters}
        initialData={initialData}
        showSource={showSource}
      />
    </div>
  );
}
