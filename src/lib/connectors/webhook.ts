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
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]));
}
function comparable(event: unknown) {
  if (!event || typeof event !== "object") return event;
  const record = event as Record<string, unknown>;
  // The same instant written with another offset is still the same event.
  const occurredAt = typeof record.occurred_at === "string" ? Date.parse(record.occurred_at) : record.occurred_at;
  return canonical({ ...record, occurred_at: occurredAt });
}
/** A repeated event_id is a safe retry only when its payload is the one already stored. */
export function isSameEvent(stored: unknown, incoming: unknown) {
  return JSON.stringify(comparable(stored)) === JSON.stringify(comparable(incoming));
}
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
