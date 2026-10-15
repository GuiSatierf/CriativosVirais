import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientContexts, tenantMembers, tenants } from "@/db/schema";
import { tenantValues } from "./tenant-scope";
function membership(executor: Pick<typeof db, "select">, userId: string) {
  return executor
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);
}
// Called with a verified server-side identity only. One tenant per user in V1.
export async function provisionTenant(user: { id: string; name: string }) {
  const [existing] = await membership(db, user.id);
  if (existing) return existing.tenantId;
  return db.transaction(async (tx) => {
    // Serialize signup and recovery for this user, including concurrent first requests.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`,
    );
    const [member] = await membership(tx, user.id);
    if (member) return member.tenantId;
    const [tenant] = await tx
      .insert(tenants)
      .values({ nome: user.name })
      .returning({ id: tenants.id });
    await tx
      .insert(tenantMembers)
      .values(tenantValues(tenant.id, { userId: user.id, role: "owner" as const }));
    await tx.insert(clientContexts).values(tenantValues(tenant.id, {}));
    return tenant.id;
  });
}
