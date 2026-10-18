import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough, type Readable, type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { backupEnv } from "@/lib/env";
import { BackupError } from "@/lib/errors";
import { encryptStream } from "./encryption";

export type Bucket = { client: S3Client; bucket: string };

/** The off-site bucket and the key that seals what goes into it; null when backups are off. */
export function backupTarget() {
  const env = backupEnv();
  if (!env) return null;
  const client = new S3Client({
    endpoint: env.BACKUP_S3_ENDPOINT,
    region: env.BACKUP_S3_REGION,
    forcePathStyle: env.BACKUP_S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: env.BACKUP_S3_ACCESS_KEY,
      secretAccessKey: env.BACKUP_S3_SECRET_KEY,
    },
  });
  return {
    target: { client, bucket: env.BACKUP_S3_BUCKET } satisfies Bucket,
    key: Buffer.from(env.BACKUP_ENCRYPTION_KEY, "base64"),
  };
}

/** Every object under a prefix with its last change, page by page. */
export async function listObjects({ client, bucket }: Bucket, prefix: string) {
  const objects = new Map<string, Date>();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const item of page.Contents ?? [])
      if (item.Key) objects.set(item.Key, item.LastModified ?? new Date(0));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

/** Deletes keys in batches; storage reports refusals in Errors instead of throwing. */
export async function deleteObjects({ client, bucket }: Bucket, keys: readonly string[]) {
  for (let start = 0; start < keys.length; start += 1000) {
    const batch = keys.slice(start, start + 1000);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (result.Errors?.length)
      throw new BackupError(`Backup storage refused to delete ${result.Errors.length} objects`);
  }
}

/**
 * Encrypts a stream into one object. An optional check runs before encryption and can fail the
 * stream at its end (a dump tool's exit code); the upload is then aborted, so no partial object
 * is ever stored under the final key.
 */
export async function uploadEncrypted(
  { client, bucket }: Bucket,
  objectKey: string,
  input: Readable,
  key: Buffer,
  check?: Transform,
) {
  const body = new PassThrough();
  const upload = new Upload({ client, params: { Bucket: bucket, Key: objectKey, Body: body } });
  const uploaded = upload.done();
  try {
    await pipeline([input, ...(check ? [check] : []), encryptStream(key), body]);
    await uploaded;
  } catch (error) {
    // The original failure is what matters; abort and the settled upload only clean up.
    await upload.abort().catch(() => undefined);
    await uploaded.catch(() => undefined);
    throw error;
  }
}
