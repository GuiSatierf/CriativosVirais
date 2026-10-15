import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/db";
import { assets, creatives } from "@/db/schema";
import { handle, apiTenant, readJson, json, HttpError } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { tenantValues, tenantWhere } from "@/lib/tenant-scope";
const schema = z
  .object({
    kind: z.enum(["video", "audio"]),
    mime: z.enum([
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
    ]),
    size: z.number().int().positive().max(250_000_000),
    creativeKey: z.string().min(1).max(200).optional(),
  })
  .strict();
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(request, schema);
    if (
      !input.mime.startsWith(input.kind + "/") ||
      (input.kind === "audio" && input.size > 25_000_000)
    )
      throw new HttpError(400, "Formato ou tamanho inválido.");
    let creativeId: string | null = null;
    if (input.creativeKey) {
      const [creative] = await db
        .select({ id: creatives.id })
        .from(creatives)
        .where(tenantWhere(creatives, tenantId, eq(creatives.creativeKey, input.creativeKey)));
      if (!creative) throw new HttpError(404, "Criativo não encontrado.");
      creativeId = creative.id;
    }
    const s3Key = `${tenantId}/${randomUUID()}`;
    const { client, bucket } = getStorage(true);
    try {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          ContentType: input.mime,
          ContentLength: input.size,
        }),
        { expiresIn: 900 },
      );
      const [asset] = await db
        .insert(assets)
        .values(
          tenantValues(tenantId, {
            creativeId,
            kind: input.kind,
            s3Key,
            mime: input.mime,
            size: BigInt(input.size),
          }),
        )
        .returning({ id: assets.id });
      return json({ assetId: asset.id, url });
    } finally {
      client.destroy();
    }
  });
}
