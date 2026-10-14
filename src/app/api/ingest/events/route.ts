import { eq, and } from "drizzle-orm";
import { integrations, salesEvents } from "@/db/schema";
import { db } from "@/db";
import { handle, json, HttpError } from "@/lib/http";
import { verifyHmac, tokenHash, decrypt } from "@/lib/crypto";
import { eventSchema, allowEvent } from "@/lib/connectors/webhook";
import { getJobs, jobTransaction } from "@/jobs";
export function POST(request: Request) {
  return handle(async () => {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (token.length < 32 || token.length > 200)
      throw new HttpError(401, "Credencial inválida.");
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "webhook"),
          eq(integrations.tokenHash, tokenHash(token)),
          eq(integrations.status, "connected"),
        ),
      )
      .limit(1);
    if (!integration?.webhookSecretEncrypted)
      throw new HttpError(401, "Credencial inválida.");
    const tenantId = integration.tenantId;
    if (!allowEvent(tenantId))
      throw new HttpError(429, "Limite temporário de eventos.");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Evento obrigatório.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64_000) {
        await reader.cancel();
        throw new HttpError(413, "Evento muito grande.");
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (
      !verifyHmac(
        body,
        decrypt(integration.webhookSecretEncrypted),
        request.headers.get("x-webhook-signature"),
      )
    )
      throw new HttpError(401, "Assinatura inválida.");
    let input;
    try {
      input = eventSchema.parse(JSON.parse(body.toString("utf8")));
    } catch {
      throw new HttpError(
        400,
        "Evento inválido. Use moeda BRL, data ISO e valores inteiros em centavos.",
      );
    }
    if (new Date(input.occurred_at).getTime() > Date.now() + 300_000)
      throw new HttpError(400, "Data futura inválida.");
    if (
      input.creative_key &&
      input.utm_content &&
      input.creative_key !== input.utm_content
    )
      throw new HttpError(400, "Chaves de criativo divergentes.");
    const boss = await getJobs();
    await jobTransaction(async (tx, connection) => {
      const [event] = await tx
        .insert(salesEvents)
        .values({
          tenantId,
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
          source: "webhook",
          raw: input,
        })
        .onConflictDoNothing({
          target: [salesEvents.tenantId, salesEvents.eventId],
        })
        .returning({ id: salesEvents.id });
      if (event)
        await boss.send(
          "ingest-event",
          { tenantId, eventId: event.id },
          { db: connection, singletonKey: event.id, retryLimit: 3 },
        );
    });
    return json({ accepted: true }, 202);
  });
}
