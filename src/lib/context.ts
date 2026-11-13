import type { z } from "zod";
import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { contextPatchSchema, contextValues } from "./ai/schemas";
import { bigintReplacer } from "./json";
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

// Bookkeeping columns change on any save, even one that repeats the same answers.
const bookkeeping = new Set(["id", "tenantId", "createdAt", "updatedAt"]);

/** True when two loaded offers hold the same answers, whatever their save time. */
export function sameOffer(saved: object | undefined, loaded: object | undefined) {
  const answers = (offer: object | undefined) =>
    JSON.stringify(
      Object.entries(offer ?? {}).filter(([key]) => bookkeeping.has(key) === false),
      bigintReplacer,
    );
  return answers(saved) === answers(loaded);
}
