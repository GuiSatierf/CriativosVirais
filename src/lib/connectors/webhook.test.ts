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
