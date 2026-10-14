import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientContexts } from "@/db/schema";
import { requireTenant } from "@/lib/tenant";
import { ContextForm } from "@/components/context-form";
import { contextPatchSchema } from "@/lib/ai/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default async function Page() {
  const { tenantId, user } = await requireTenant();
  const [context] = await db
    .select()
    .from(clientContexts)
    .where(eq(clientContexts.tenantId, tenantId));
  const initial = contextPatchSchema.parse(
    Object.fromEntries(
      Object.entries({
        ...context,
        ticketCents: context.ticketCents?.toString() ?? null,
      }).filter(
        ([key, value]) =>
          key in contextPatchSchema.shape &&
          (value !== null || ["ticketCents", "estadoCliente"].includes(key)),
      ),
    ),
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Minha conta</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contexto da operação</CardTitle>
        </CardHeader>
        <CardContent>
          <ContextForm initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
