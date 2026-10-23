import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SalesEventInput } from "../sales-events";

/** Hotmart proves who it is only with the account's hottok; compared in constant time. */
export function sameHottok(received: string | null, expected: string) {
  if (received == null) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

const trackingCode = z.string().trim().max(200).optional().catch(undefined);

// Only the fields a sale needs; buyer data never leaves this parser.
const purchaseSaleSchema = z.object({
  id: z.string().min(1).max(200),
  creation_date: z.number().int().positive(),
  event: z.string().min(1).max(100),
  data: z.object({
    purchase: z.object({
      transaction: z.string().min(1).max(100),
      price: z.object({ value: z.number().finite().nonnegative(), currency_value: z.string() }).optional(),
      origin: z.object({ src: trackingCode, sck: trackingCode, xcod: trackingCode }).optional(),
    }),
  }),
});

// PURCHASE_COMPLETE repeats an approved sale after the warranty ends, so it adds nothing.
const statusOf: Record<string, SalesEventInput["status"]> = {
  PURCHASE_APPROVED: "approved",
  PURCHASE_REFUNDED: "refunded",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_CANCELED: "cancelled",
  PURCHASE_EXPIRED: "failed",
  PURCHASE_BILLET_PRINTED: "pending",
  PURCHASE_DELAYED: "pending",
};

/** The creative code from the sales link: src on the sales page, sck on the checkout, xcod as custom. */
function creativeKey(origin: { src?: string; sck?: string; xcod?: string } | undefined) {
  const code = [origin?.src, origin?.sck, origin?.xcod].find((value) => value != null && value.length > 0);
  return code ?? undefined;
}

/** Reais as Hotmart sends them (a double) to whole cents, through text so 1.005 is not 100.49. */
function reaisToCents(value: number) {
  if (value > Number.MAX_SAFE_INTEGER / 100) return null;
  const [whole, fraction = ""] = value.toFixed(2).split(".");
  return Number(whole) * 100 + Number(fraction);
}

/**
 * Maps a Hotmart purchase webhook (v2.0.0) to a sale, or null for events that are not one.
 * Reversals carry the reverted amount, which the ranking subtracts from the approved one.
 */
export function hotmartSale(body: unknown): SalesEventInput | null {
  const parsed = purchaseSaleSchema.safeParse(body);
  if (!parsed.success) return null;
  const { event, creation_date: createdAt, data } = parsed.data;
  const status = statusOf[event];
  if (status == null) return null;
  const price = data.purchase.price;
  const key = creativeKey(data.purchase.origin);
  return {
    event_id: `hotmart:${data.purchase.transaction}:${status}`,
    occurred_at: new Date(Math.min(createdAt, Date.now())).toISOString(),
    status,
    currency: "BRL",
    // A sale in another currency still counts as a sale; its amount stays unknown so units never mix.
    revenue: price?.currency_value === "BRL" ? reaisToCents(price.value) : null,
    profit: null,
    ...(key == null ? {} : { creative_key: key, utm_content: key }),
  };
}
