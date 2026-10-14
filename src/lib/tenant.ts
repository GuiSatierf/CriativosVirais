import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getAuth } from "./auth";
import { provisionTenant } from "./provision-tenant";
// Never accept tenant IDs from form fields, route parameters, cookies or model tools.
export const requireTenant = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // Recovers an interrupted signup without creating duplicate or orphan tenants.
  const tenantId = await provisionTenant(session.user);
  return { tenantId, user: session.user };
});
export async function tenantWhere(table: { tenantId: PgColumn }, extra?: SQL) {
  const { tenantId } = await requireTenant();
  return and(eq(table.tenantId, tenantId), extra)!;
}
export async function tenantValues<T extends Record<string, unknown>>(
  values: T,
) {
  const { tenantId } = await requireTenant();
  return { ...values, tenantId }; // Server identity always overrides caller input.
}
