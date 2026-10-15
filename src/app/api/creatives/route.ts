import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatives } from "@/db/schema";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { getCreatives } from "@/lib/creatives";
import { tenantWhere } from "@/lib/tenant-scope";
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    return json(await getCreatives(tenantId, Object.fromEntries(new URL(request.url).searchParams)));
  });
}
/** Hiding only affects the list; metrics and analyses stay available. */
export function PATCH(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z
        .object({
          creativeKey: z.string().min(1).max(200),
          hidden: z.boolean(),
        })
        .strict(),
    );
    const [row] = await db
      .update(creatives)
      .set({ hiddenAt: input.hidden ? new Date() : null })
      .where(
        tenantWhere(creatives, tenantId, eq(creatives.creativeKey, input.creativeKey)),
      )
      .returning({ id: creatives.id });
    if (!row) throw new HttpError(404, "Criativo não encontrado.");
    return json({ saved: true });
  });
}
