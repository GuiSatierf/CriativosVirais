import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyHmac } from "../crypto";
import { eventSchema } from "./webhook";
describe("webhook signature and contract", () => {
  const body = '{"event_id":"order-1"}';
  const secret = "test-only-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  it("accepts raw-body HMAC with optional sha256 prefix", () => {
    expect(verifyHmac(body, secret, signature)).toBe(true);
    expect(verifyHmac(body, secret, "sha256=" + signature)).toBe(true);
  });
  it("rejects tampering, missing, malformed and different-secret signatures", () => {
    expect(verifyHmac(body + " ", secret, signature)).toBe(false);
    expect(verifyHmac(body, secret, null)).toBe(false);
    expect(verifyHmac(body, secret, "a".repeat(63))).toBe(false);
    expect(verifyHmac(body, "other", signature)).toBe(false);
  });
  it("rejects blank event and attribution keys and trims meaningful keys", () => {
    const event = { event_id: " event-1 ", occurred_at: "2026-10-13T12:00:00-03:00",
      status: "approved", currency: "BRL", creative_key: " AD-1 " };
    expect(eventSchema.parse(event).creative_key).toBe("AD-1");
    expect(eventSchema.parse(event).event_id).toBe("event-1");
    expect(eventSchema.safeParse({ ...event, event_id: "   " }).success).toBe(false);
    expect(eventSchema.safeParse({ ...event, creative_key: "   " }).success).toBe(false);
    expect(eventSchema.safeParse({ ...event, utm_content: "" }).success).toBe(false);
  });
  it("rejects client-supplied tenant IDs, unsupported currency and unsafe cents", () => {
    const event = {
      event_id: "order-1-paid",
      occurred_at: "2026-10-13T12:00:00-03:00",
      status: "approved",
      currency: "BRL",
      revenue: 99700,
    };
    expect(eventSchema.parse(event).profit).toBeNull();
    expect(() =>
      eventSchema.parse({ ...event, tenant_id: "foreign" }),
    ).toThrow();
    expect(() => eventSchema.parse({ ...event, currency: "USD" })).toThrow();
    expect(() =>
      eventSchema.parse({ ...event, revenue: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow();
  });
});
