import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Tenant scoping for every read, update and delete. `tenantId` must come from
 * the authenticated session or a server-controlled job payload, never from
 * client input.
 */
export function tenantWhere(
  table: { tenantId: PgColumn },
  tenantId: string,
  ...extra: (SQL | undefined)[]
) {
  return and(eq(table.tenantId, tenantId), ...extra)!;
}

/** Insert values with the server tenant overriding anything the caller set. */
export function tenantValues<T extends Record<string, unknown>>(
  tenantId: string,
  values: T,
) {
  return { ...values, tenantId };
}
