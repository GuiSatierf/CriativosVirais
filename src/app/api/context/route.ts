import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
import { contextPatchSchema } from "@/lib/ai/schemas";
import { updateContext } from "@/lib/context";
import { tenantWhere } from "@/lib/tenant-scope";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const [context] = await db
      .select()
      .from(clientContexts)
      .where(tenantWhere(clientContexts, tenantId));
    return json(context);
  });
}
export function PATCH(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const patch = await readJson(request, contextPatchSchema);
    await updateContext(tenantId, patch);
    return json({ saved: true });
  });
}
