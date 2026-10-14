import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches } from "@/db/schema";
import { requireTenant } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
export default async function Page() {
  const { tenantId } = await requireTenant();
  const rows = await db
    .select({
      id: batches.id,
      title: batches.title,
      product: batches.produtoNome,
      round: batches.roundNumber,
    })
    .from(batches)
    .where(eq(batches.tenantId, tenantId))
    .orderBy(desc(batches.createdAt));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Levas de criativos</h1>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          Suas levas aparecerão aqui. Comece contando sobre sua oferta na
          conversa.
        </p>
      ) : (
        rows.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="pt-5">
              <Link
                className="font-medium underline"
                href={`/levas/${batch.id}`}
              >
                {batch.title}
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                {batch.product} · Rodada {batch.round}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
