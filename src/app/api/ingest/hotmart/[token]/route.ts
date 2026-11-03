import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { decrypt, tokenHash } from "@/lib/crypto";
import { hotmartSale, sameHottok } from "@/lib/connectors/hotmart";
import { allowEvent } from "@/lib/connectors/webhook";
import { handle, HttpError, json, readBody } from "@/lib/http";
import { recordSalesEvent } from "@/lib/sales-events";

/**
 * A client's own Hotmart sales (webhook v2.0.0). Hotmart cannot add headers of ours, so the
 * connection is found by the token in the URL and proven by the client's hottok.
 */
export function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    if (token.length < 32 || token.length > 200) throw new HttpError(401, "Credencial inválida.");
    const [integration] = await db
      .select({ tenantId: integrations.tenantId, hottok: integrations.webhookSecretEncrypted })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "hotmart"),
          eq(integrations.tokenHash, tokenHash(token)),
          eq(integrations.status, "connected"),
        ),
      )
      .limit(1);
    if (integration?.hottok == null) throw new HttpError(401, "Credencial inválida.");
    if (!sameHottok(request.headers.get("x-hotmart-hottok"), decrypt(integration.hottok)))
      throw new HttpError(401, "Credencial inválida.");
    if (!allowEvent(integration.tenantId)) throw new HttpError(429, "Limite temporário de eventos.");
    const raw = (await readBody(request, 256_000)).toString("utf8");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Dados inválidos.");
    }
    const sale = hotmartSale(body);
    // Hotmart retries anything but 2xx; events that are not a sale are acknowledged and dropped.
    if (sale == null) return json({ accepted: false });
    await recordSalesEvent(integration.tenantId, sale, "hotmart");
    return json({ accepted: true });
  });
}
