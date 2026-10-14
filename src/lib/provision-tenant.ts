import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientContexts, tenantMembers, tenants } from "@/db/schema";
// Called with a verified server-side identity only. One tenant per user in V1.
export async function provisionTenant(user: { id: string; name: string }) {
  return db.transaction(async (tx) => {
    // Serialize signup and recovery for this user, including concurrent first requests.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`,
    );
    const [membership] = await tx
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, user.id))
      .limit(1);
    if (membership) return membership.tenantId;
    const [tenant] = await tx
      .insert(tenants)
      .values({ nome: user.name })
      .returning({ id: tenants.id });
    await tx
      .insert(tenantMembers)
      .values({ tenantId: tenant.id, userId: user.id, role: "owner" });
    await tx.insert(clientContexts).values({ tenantId: tenant.id });
    return tenant.id;
  });
}
