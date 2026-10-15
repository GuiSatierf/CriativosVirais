import "server-only";
import { eq } from "drizzle-orm";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";
import { db } from "@/db";
import { tenantMembers, tenants } from "@/db/schema";
import { getStorage } from "./storage";

async function deletePrefix(client: S3Client, bucket: string, prefix: string) {
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (page.Contents ?? []).flatMap((item) =>
      item.Key ? [{ Key: item.Key }] : [],
    );
    if (keys.length)
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys, Quiet: true },
        }),
      );
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

/**
 * Erases everything the user owns before the auth row goes: stored files and
 * the tenant, whose rows cascade to all client data. V1 has one owner per tenant.
 */
export async function deleteAccountData(userId: string) {
  const memberships = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId));
  const { client, bucket } = getStorage();
  try {
    for (const { tenantId } of memberships)
      await deletePrefix(client, bucket, `${tenantId}/`);
    await deletePrefix(client, bucket, `avatars/${userId}/`);
  } finally {
    client.destroy();
  }
  for (const { tenantId } of memberships)
    await db.delete(tenants).where(eq(tenants.id, tenantId));
}
