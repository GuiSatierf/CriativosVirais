import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { db } from "@/db";
import { user } from "@/db/schema";
import { handle, apiTenant, readBody, json, HttpError } from "@/lib/http";
import { getStorage } from "@/lib/storage";
import { logError } from "@/lib/log";

const maxBytes = 2_000_000;
const mimeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

/** Checks the file signature so a renamed file cannot pass as an image. */
function matchesSignature(mime: z.infer<typeof mimeSchema>, body: Buffer) {
  if (mime === "image/png")
    return body
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg")
    return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  return (
    body.subarray(0, 4).toString("latin1") === "RIFF" &&
    body.subarray(8, 12).toString("latin1") === "WEBP"
  );
}

/** Only objects this route wrote for the user are read or deleted. */
function ownKey(userId: string, image: string | null | undefined) {
  return image?.startsWith(`avatars/${userId}/`) ? image : null;
}

async function currentKey(userId: string) {
  const [row] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId));
  return ownKey(userId, row?.image);
}

async function removeObject(key: string) {
  const { client, bucket } = getStorage();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    // The profile already points elsewhere; a leftover object is harmless.
    logError("avatar", error);
  } finally {
    client.destroy();
  }
}

export function GET(request: Request) {
  return handle(async () => {
    const { user: me } = await apiTenant(request);
    const key = await currentKey(me.id);
    if (!key) throw new HttpError(404, "Foto não encontrada.");
    const { client, bucket } = getStorage();
    try {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!object.Body) throw new HttpError(404, "Foto não encontrada.");
      const bytes = await object.Body.transformToByteArray();
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": mimeSchema.catch("image/jpeg").parse(object.ContentType),
          // The URL carries the object id, so a new photo gets a new URL.
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } finally {
      client.destroy();
    }
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const { user: me } = await apiTenant(request);
    const mime = mimeSchema.safeParse(request.headers.get("content-type"));
    if (!mime.success)
      throw new HttpError(400, "Envie uma foto em JPG, PNG ou WEBP.");
    const body = await readBody(request, maxBytes);
    if (!body.length || !matchesSignature(mime.data, body))
      throw new HttpError(400, "Envie uma foto em JPG, PNG ou WEBP.");
    const previous = await currentKey(me.id);
    const key = `avatars/${me.id}/${randomUUID()}`;
    const { client, bucket } = getStorage();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mime.data,
          ContentLength: body.length,
        }),
      );
    } finally {
      client.destroy();
    }
    await db.update(user).set({ image: key }).where(eq(user.id, me.id));
    if (previous) await removeObject(previous);
    return json({ saved: true });
  });
}

export function DELETE(request: Request) {
  return handle(async () => {
    const { user: me } = await apiTenant(request);
    const previous = await currentKey(me.id);
    await db.update(user).set({ image: null }).where(eq(user.id, me.id));
    if (previous) await removeObject(previous);
    return json({ saved: true });
  });
}
