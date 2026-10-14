import { z } from "zod";
import { handle, apiTenant, json } from "@/lib/http";
import { getBatchResults } from "@/lib/results";
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    return json(
      await getBatchResults(
        tenantId,
        z.uuid().parse((await context.params).id),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  });
}
