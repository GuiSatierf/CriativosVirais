import type { z } from "zod";
import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { contextPatchSchema, contextValues } from "./ai/schemas";
import { tenantWhere } from "./tenant-scope";
export function updateContext(
  tenantId: string,
  patch: z.infer<typeof contextPatchSchema>,
) {
  return db
    .update(clientContexts)
    .set(contextValues(patch))
    .where(tenantWhere(clientContexts, tenantId));
}
