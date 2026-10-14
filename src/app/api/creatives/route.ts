import { handle, apiTenant, json } from "@/lib/http";
import { getCreatives } from "@/lib/creatives";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    return json(await getCreatives(tenantId, Object.fromEntries(new URL(request.url).searchParams)));
  });
}
