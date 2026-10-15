import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { handle, apiTenant, json, HttpError } from "@/lib/http";
import { tenantWhere } from "@/lib/tenant-scope";
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = z.uuid().parse((await context.params).id);
    const [asset] = await db
      .select({
        id: assets.id,
        status: assets.status,
        kind: assets.kind,
        error: assets.errorMessage,
        transcription: assets.transcription,
      })
      .from(assets)
      .where(tenantWhere(assets, tenantId, eq(assets.id, id)));
    if (!asset) throw new HttpError(404, "Arquivo não encontrado.");
    return json(asset);
  });
}
