import { handle, apiTenant, readJson, json } from "@/lib/http";
import { csvImportSchema, mappedMetrics, parseCsv } from "@/lib/connectors/csv";
import { saveMetrics } from "@/lib/connectors/persist";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(request, csvImportSchema, 10_100_000);
    const records = parseCsv(input);
    return json({
      imported: await saveMetrics(tenantId, records, input.metricDefinitions, mappedMetrics(input.mapping)),
    });
  });
}
