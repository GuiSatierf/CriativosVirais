import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { handle, apiTenant, json, HttpError } from "@/lib/http";
import { getJobs } from "@/jobs";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = z.uuid().parse((await context.params).id);
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), eq(assets.id, id)));
    if (!asset || !asset.uploadCompletedAt)
      throw new HttpError(404, "Arquivo não encontrado.");
    if (asset.status !== "error")
      throw new HttpError(409, "O arquivo não está em erro.");
    const boss = await getJobs();
    await boss.send(
      "analyze-video",
      { tenantId, assetId: id },
      { singletonKey: id, retryLimit: 3 },
    );
    return json({ queued: true }, 202);
  });
}
