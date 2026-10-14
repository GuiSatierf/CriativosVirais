import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { assets } from "@/db/schema";
import { db } from "@/db";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getJobs, jobTransaction } from "@/jobs";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const { assetId } = await readJson(
      request,
      z.object({ assetId: z.uuid() }).strict(),
    );
    const where = and(eq(assets.tenantId, tenantId), eq(assets.id, assetId));
    const [asset] = await db.select().from(assets).where(where);
    if (!asset) throw new HttpError(404, "Arquivo não encontrado.");
    if (asset.uploadCompletedAt) return json({ assetId, status: asset.status });
    const { client, bucket } = getStorage();
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: asset.s3Key }),
        { abortSignal: AbortSignal.timeout(20_000) },
      );
      if (
        head.ContentLength !== Number(asset.size) ||
        head.ContentType !== asset.mime
      )
        throw new HttpError(
          400,
          "O upload não corresponde ao arquivo declarado.",
        );
    } finally {
      client.destroy();
    }
    const boss = await getJobs();
    await jobTransaction(async (tx, connection) => {
      const updated = await tx
        .update(assets)
        .set({ uploadCompletedAt: new Date() })
        .where(
          and(
            where,
            eq(assets.status, "uploaded"),
            isNull(assets.uploadCompletedAt),
          ),
        )
        .returning();
      if (updated.length)
        await boss.send(
          "analyze-video",
          { tenantId, assetId },
          { db: connection, singletonKey: assetId, retryLimit: 3 },
        );
    });
    return json({ assetId, status: "uploaded" }, 202);
  });
}
