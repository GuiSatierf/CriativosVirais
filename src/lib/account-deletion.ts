import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMembers, tenants } from "@/db/schema";
import { getStorage } from "./storage";
import { deleteStoragePrefix } from "./storage-prefix";

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
      await deleteStoragePrefix(client, bucket, `${tenantId}/`);
    await deleteStoragePrefix(client, bucket, `avatars/${userId}/`);
  } finally {
    client.destroy();
  }
  for (const { tenantId } of memberships)
    await db.delete(tenants).where(eq(tenants.id, tenantId));
}
