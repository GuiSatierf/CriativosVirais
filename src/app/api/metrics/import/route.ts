import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { csvImportSchema, parseCsv } from "@/lib/connectors/csv";
import { saveMetrics } from "@/lib/connectors/persist";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(request, csvImportSchema, 6_000_000);
    try {
      const records = parseCsv(input);
      return json({
        imported: await saveMetrics(tenantId, records, input.metricDefinitions),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error && error.message.length < 300
          ? error.message
          : "CSV inválido.",
      );
    }
  });
}
