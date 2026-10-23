import { applyPurchaseEvent, parsePurchaseEvent, requireHotmart } from "@/lib/hotmart-access";
import { handle, json, readBody } from "@/lib/http";
import { HttpError } from "@/lib/errors";

/** Hotmart purchase webhook (v2.0.0) for the product that sells this app: grants and revokes access. */
export function POST(request: Request) {
  return handle(async () => {
    const config = requireHotmart(request.headers.get("x-hotmart-hottok"));
    const raw = (await readBody(request, 256_000)).toString("utf8");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Dados inválidos.");
    }
    const result = await applyPurchaseEvent(parsePurchaseEvent(body), config.HOTMART_PRODUCT_IDS);
    return json({ result });
  });
}
