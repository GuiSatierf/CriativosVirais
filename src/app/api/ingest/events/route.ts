import { eq, and } from "drizzle-orm";
import { integrations } from "@/db/schema";
import { db } from "@/db";
import { handle, json, readBody, HttpError } from "@/lib/http";
import { verifyHmac, tokenHash, decrypt } from "@/lib/crypto";
import { eventSchema, allowEvent } from "@/lib/connectors/webhook";
import { recordSalesEvent } from "@/lib/sales-events";
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
    const body = await readBody(request, 64_000);
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
        "Evento inválido. Use moeda BRL, data com fuso horário e valores inteiros em centavos.",
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
    await recordSalesEvent(tenantId, input, "webhook");
    return json({ accepted: true }, 202);
  });
}
