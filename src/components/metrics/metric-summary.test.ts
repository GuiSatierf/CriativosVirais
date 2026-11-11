import { describe, expect, it } from "vitest";
import { summaryTotal } from "./metric-summary";

const metrics = (approved_sales: string | null) => ({ spend_cents: null, revenue_cents: null, approved_sales });

describe("KPI totals", () => {
  // A creative with sales in one campaign and a blank cell in another counted as fully reported,
  // so the tile showed a partial total without saying so.
  it("counts a creative as reported only when all its rows have the value", () => {
    const rows = [
      { key: "L01-C01", metrics: metrics("3") },
      { key: "L01-C01", metrics: metrics(null) },
      { key: "L01-C02", metrics: metrics("2") },
    ];

    const total = summaryTotal(rows, "approved_sales");

    expect(total).toEqual({ value: "5", reported: 1 });
  });

  it("stays unknown when no row reported the value", () => {
    expect(summaryTotal([{ key: "L01-C01", metrics: metrics(null) }], "approved_sales")).toEqual({ value: null, reported: 0 });
  });
});
