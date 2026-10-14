import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
import { contextPatchSchema, contextValues } from "@/lib/ai/schemas";
import { eq } from "drizzle-orm";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const [context] = await db
      .select()
      .from(clientContexts)
      .where(eq(clientContexts.tenantId, tenantId));
    return json(context);
  });
}
export function PATCH(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const patch = await readJson(request, contextPatchSchema);
    await db
      .update(clientContexts)
      .set(contextValues(patch))
      .where(eq(clientContexts.tenantId, tenantId));
    return json({ saved: true });
  });
}
