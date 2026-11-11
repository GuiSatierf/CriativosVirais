import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function cancellation(dateNextCharge: unknown) {
  return {
    id: "evento-1",
    event: "SUBSCRIPTION_CANCELLATION",
    data: {
      product: { id: 1234567 },
      subscriber: { email: "aluna@exemplo.test" },
      subscription: { id: 98765 },
      date_next_charge: dateNextCharge,
    },
  };
}

describe("Hotmart access events", { timeout: 60_000 }, () => {
  // A cancellation whose last paid day came as 0 used to be dropped as "ignored", so access never ended.
  it("keeps a cancellation whose next charge date it cannot read, ending access at once", async () => {
    const { parseCancellationEvent } = await import("./hotmart-access");

    const event = parseCancellationEvent(cancellation(0));

    expect(event?.data.date_next_charge).toBeNull();
  });

  it("logs an access event it cannot read, since Hotmart will not send it again", async () => {
    const { parsePurchaseEvent } = await import("./hotmart-access");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const event = parsePurchaseEvent({ id: "evento-2", event: "PURCHASE_REFUNDED", data: {} });

    expect(event).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[hotmart-access]"));
    log.mockRestore();
  });
});
