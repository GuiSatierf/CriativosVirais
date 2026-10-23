import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { provisionTenant } from "./provision-tenant";
// Never accept tenant IDs from form fields, route parameters, cookies or model tools.
export const requireTenant = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // Recovers an interrupted signup without creating duplicate or orphan tenants.
  const tenantId = await provisionTenant(session.user);
  return { tenantId, user: session.user, session: session.session };
});
export { tenantWhere, tenantValues } from "./tenant-scope";
