import { describe, it, expect } from "vitest";
import { parseCsv, csvImportSchema, type CsvInput } from "./csv";
const base: CsvInput = {
  csv: "",
  mapping: {
    creative_key: "key",
    spend_cents: "spend",
    approved_sales: "sales",
    profit_cents: "profit",
  },
  from: "2026-10-01",
  to: "2026-10-13",
  decimal: "comma",
  moneyUnit: "major",
  metricDefinitions: {},
};
describe("CSV normalization", () => {
  it("requires registered Hook Rate and Body Rate formulas", () => {
    const input = {
      ...base,
      csv: "key;spend;sales;profit;hook\nAD-1;10;1;1;30",
      mapping: { ...base.mapping, hook_rate: "hook" },
    };
    expect(() => parseCsv(input)).toThrow("fórmula");
    expect(
      parseCsv({
        ...input,
        metricDefinitions: { hook_rate: "views_3s / impressions * 100 (%)" },
      })[0].hook_rate,
    ).toBe(30);
  });
  it("preserves null, actual zero, Brazilian decimals and negative profit", () => {
    const [a, b] = parseCsv({
      ...base,
      csv: "key;spend;sales;profit\nAD-1;1.234,56;0;-10,90\nAD-2;;;",
    });
    expect(a.spend_cents).toBe("123456");
    expect(a.approved_sales).toBe("0");
    expect(a.profit_cents).toBe("-1090");
    expect(b.spend_cents).toBeNull();
    expect(b.ctr).toBeNull();
  });
  it("keeps bigint cents exact and rejects unsupported precision", () => {
    expect(
      parseCsv({
        ...base,
        decimal: "dot",
        moneyUnit: "cents",
        csv: "key,spend,sales,profit\nAD-1,9007199254740993,1,",
      })[0].spend_cents,
    ).toBe("9007199254740993");
    expect(() =>
      parseCsv({
        ...base,
        decimal: "dot",
        csv: "key,spend,sales,profit\nAD-1,1.234,1,",
      }),
    ).toThrow();
  });
  it("enforces UTF-8 byte limits and rejects unknown mapping fields", () => {
    expect(() => parseCsv({ ...base, csv: "á".repeat(2_500_001) })).toThrow("5 MB");
    expect(() => csvImportSchema.parse({ ...base, csv: "key;spend;sales;profit\nAD-1;1;1;1",
      mapping: { ...base.mapping, tenant_id: "key" } })).toThrow();
  });
  it("rejects excessive numeric lengths and fractional counts before bigint conversion", () => {
    expect(() => parseCsv({ ...base, decimal: "dot", moneyUnit: "cents",
      csv: "key,spend,sales,profit\nAD-1," + "9".repeat(1000) + ",1," })).toThrow("limite");
    expect(() => parseCsv({ ...base, decimal: "dot",
      csv: "key,spend,sales,profit\nAD-1,1,1.5," })).toThrow("métrica inválida");
  });
  it("rejects missing keys, repeated keys, duplicate headers and invalid dates", () => {
    expect(() =>
      parseCsv({ ...base, csv: "key;spend;sales;profit\n;10;1;2" }),
    ).toThrow();
    expect(() =>
      parseCsv({
        ...base,
        csv: "key;spend;sales;profit\nAD-1;10;1;2\nAD-1;20;2;3",
      }),
    ).toThrow();
    expect(() =>
      parseCsv({ ...base, csv: "key;key;spend\nAD-1;AD-2;10" }),
    ).toThrow();
    expect(() =>
      parseCsv({
        ...base,
        to: "2026-02-31",
        csv: "key;spend;sales;profit\nAD-1;10;1;2",
      }),
    ).toThrow();
  });
});
