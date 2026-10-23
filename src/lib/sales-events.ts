import "server-only";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { salesEvents } from "@/db/schema";
import { HttpError } from "./errors";
import { tenantValues, tenantWhere } from "./tenant-scope";
import { eventSchema, isSameEvent } from "./connectors/webhook";
import { getJobs, jobTransaction } from "@/jobs";

export type SalesEventInput = z.infer<typeof eventSchema>;
type Transaction = Parameters<Parameters<typeof jobTransaction>[0]>[0];

/** A known event_id is accepted again only as an exact retry; changed content must use a new id. */
async function assertReplay(tx: Transaction, tenantId: string, input: SalesEventInput) {
  const [stored] = await tx
    .select({ raw: salesEvents.raw })
    .from(salesEvents)
    .where(tenantWhere(salesEvents, tenantId, eq(salesEvents.eventId, input.event_id)));
  if (stored && isSameEvent(stored.raw, input)) return;
  throw new HttpError(
    409,
    "Este event_id já foi recebido com outro conteúdo. Envie a mudança, como um reembolso, com um novo event_id.",
  );
}

/** Stores one sale for a server-resolved tenant and queues its processing once. */
export async function recordSalesEvent(tenantId: string, input: SalesEventInput, source: "webhook") {
  const boss = await getJobs();
  await jobTransaction(async (tx, connection) => {
    const [event] = await tx
      .insert(salesEvents)
      .values(tenantValues(tenantId, {
        eventId: input.event_id,
        occurredAt: new Date(input.occurred_at),
        status: input.status,
        currency: input.currency,
        revenueCents: input.revenue === null ? null : BigInt(input.revenue),
        profitCents: input.profit === null ? null : BigInt(input.profit),
        creativeKey: input.creative_key ?? input.utm_content ?? null,
        utmContent: input.utm_content,
        utmSource: input.utm_source,
        utmCampaign: input.utm_campaign || null,
        utmMedium: input.utm_medium,
        utmTerm: input.utm_term,
        source,
        raw: input,
      }))
      .onConflictDoNothing({ target: [salesEvents.tenantId, salesEvents.eventId] })
      .returning({ id: salesEvents.id });
    if (!event) {
      await assertReplay(tx, tenantId, input);
      return;
    }
    await boss.send("ingest-event", { tenantId, eventId: event.id }, { db: connection, singletonKey: event.id });
  });
}
