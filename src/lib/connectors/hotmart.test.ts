import { describe, expect, it, vi } from "vitest";
import { hotmartSale } from "./hotmart";

const purchase = (price: { value: number; currency_value: string }) => ({
  id: "evento",
  creation_date: Date.now() - 1000,
  event: "PURCHASE_APPROVED",
  data: { purchase: { transaction: "HP1", price, origin: { src: "L01-C02" } } },
});

describe("Hotmart sale", () => {
  it("counts a sale in another currency with the amount unknown instead of dropping it", () => {
    const sale = hotmartSale(purchase({ value: 49.9, currency_value: "USD" }));
    expect(sale).toMatchObject({ status: "approved", revenue: null, creative_key: "L01-C02" });
  });

  it("converts reais to cents through text, without float drift", () => {
    expect(hotmartSale(purchase({ value: 97.5, currency_value: "BRL" }))?.revenue).toBe(9750);
    expect(hotmartSale(purchase({ value: 0.29, currency_value: "BRL" }))?.revenue).toBe(29);
  });

  it("counts a sale whose price or origin comes as null, with those parts unknown", () => {
    const body = purchase({ value: 1, currency_value: "BRL" });
    const withoutPrice = { ...body, data: { purchase: { transaction: "HP2", price: null, origin: null } } };

    const sale = hotmartSale(withoutPrice);

    expect(sale).toMatchObject({ status: "approved", revenue: null });
    expect(sale).not.toHaveProperty("creative_key");
  });

  it("logs a sale event it cannot read instead of dropping it silently", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = { ...purchase({ value: 1, currency_value: "BRL" }), data: { purchase: {} } };

    const sale = hotmartSale(body);

    expect(sale).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[hotmart-sale]"));
    log.mockRestore();
  });
});
