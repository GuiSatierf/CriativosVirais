import { handle, apiTenant, json } from "@/lib/http";
import { getBenchmark } from "@/lib/benchmark";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    return json(
      await getBenchmark(
        tenantId,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  });
}
