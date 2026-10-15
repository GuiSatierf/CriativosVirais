import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { db } from "@/db";
import { assets, creatives } from "@/db/schema";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { tenantWhere } from "@/lib/tenant-scope";

/** Deletes every video of a creative: stored files, assets and their analyses. */
export function DELETE(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z.object({ creativeKey: z.string().min(1).max(200) }).strict(),
    );
    const [creative] = await db
      .select({ id: creatives.id })
      .from(creatives)
      .where(
        tenantWhere(creatives, tenantId, eq(creatives.creativeKey, input.creativeKey)),
      );
    if (!creative) throw new HttpError(404, "Criativo não encontrado.");
    const where = tenantWhere(
      assets,
      tenantId,
      and(eq(assets.creativeId, creative.id), eq(assets.kind, "video")),
    );
    const rows = await db
      .select({ s3Key: assets.s3Key, status: assets.status })
      .from(assets)
      .where(where);
    if (!rows.length) throw new HttpError(404, "Este criativo não tem vídeo.");
    if (rows.some((row) => row.status === "processing"))
      throw new HttpError(
        409,
        "O vídeo ainda está em análise. Tente excluir quando a análise terminar.",
      );
    const { client, bucket } = getStorage();
    try {
      const keys = rows
        .map((row) => row.s3Key)
        .filter((key) => key.startsWith(`${tenantId}/`));
      if (keys.length)
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          }),
        );
    } finally {
      client.destroy();
    }
    // Analyses cascade from their asset.
    await db.delete(assets).where(where);
    return json({ deleted: true });
  });
}
