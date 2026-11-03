import {
  applyCancellationEvent,
  applyPurchaseEvent,
  parseCancellationEvent,
  parsePurchaseEvent,
  requireHotmart,
} from "@/lib/hotmart-access";
import { handle, json, readBody } from "@/lib/http";
import { HttpError } from "@/lib/errors";

/** Hotmart webhook (v2.0.0) for the product that sells this app: purchases grant access, reversals and cancellations end it. */
export function POST(request: Request) {
  return handle(async () => {
    const config = await requireHotmart(request.headers.get("x-hotmart-hottok"));
    const raw = (await readBody(request, 256_000)).toString("utf8");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Dados inválidos.");
    }
    const cancellation = parseCancellationEvent(body);
    if (cancellation != null) return json({ result: await applyCancellationEvent(cancellation, config.productIds) });
    const result = await applyPurchaseEvent(parsePurchaseEvent(body), config.productIds);
    return json({ result });
  });
}
