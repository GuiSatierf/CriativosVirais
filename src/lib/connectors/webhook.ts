import { z } from "zod";
const cents = z.number().int().safe().nonnegative().nullable();
export const eventSchema = z
  .object({
    event_id: z.string().trim().min(1).max(200),
    occurred_at: z.iso.datetime({ offset: true }),
    status: z.enum([
      "pending",
      "approved",
      "refunded",
      "chargeback",
      "cancelled",
      "failed",
    ]),
    currency: z.literal("BRL"),
    revenue: cents.default(null),
    profit: z.number().int().safe().nullable().default(null),
    creative_key: z.string().trim().min(1).max(200).optional(),
    utm_source: z.string().max(200).optional(),
    utm_campaign: z.string().trim().max(200).optional(),
    utm_medium: z.string().max(200).optional(),
    utm_content: z.string().trim().min(1).max(200).optional(),
    utm_term: z.string().max(200).optional(),
  })
  .strict();
// Per-process bound, keyed by a server-resolved integration tenant, never caller tenant_id.
const windows = new Map<string, { count: number; until: number }>();
export function allowEvent(tenantId: string, now = Date.now()) {
  for (const [key, value] of windows)
    if (value.until <= now) windows.delete(key);
  const value = windows.get(tenantId) ?? { count: 0, until: now + 60_000 };
  value.count++;
  windows.set(tenantId, value);
  return value.count <= 120;
}
