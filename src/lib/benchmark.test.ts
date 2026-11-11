import { describe, it, expect } from "vitest";
import { summarizeRankings } from "./benchmark";
describe("tenant benchmark interpretation", () => {
  it("returns no fabricated ranking when there are no comparable metrics", () =>
    expect(summarizeRankings([]).warning).toContain("chave confiável"));
  it("keeps only top five and distinguishes missing sales from weak sales", () => {
    const result = summarizeRankings([
      {
        creative_key: "attention",
        metric: "ctr",
        value: "5",
        rank: 1,
        percentile: 0,
      },
      {
        creative_key: "attention",
        metric: "profit_cents",
        value: "-300",
        rank: 9,
        percentile: 0.9,
      },
      {
        creative_key: "economic",
        metric: "profit_cents",
        value: "9007199254740993",
        rank: 1,
        percentile: 0,
      },
      {
        creative_key: "economic",
        metric: "ctr",
        value: "1",
        rank: 6,
        percentile: 0.6,
      },
      {
        creative_key: "unknown",
        metric: "hook_rate",
        value: "70",
        rank: 2,
        percentile: 0.1,
      },
    ]);
    expect(result.top.ctr.map((r) => r.creative_key)).toEqual(["attention"]);
    expect(
      result.intersections.find((r) => r.creative_key === "attention")
        ?.attentionStrongSalesWeak,
    ).toBe(true);
    expect(
      result.intersections.find((r) => r.creative_key === "economic")
        ?.salesStrongAttentionMedian,
    ).toBe(true);
    expect(
      result.intersections.find((r) => r.creative_key === "unknown")
        ?.attentionStrongSalesWeak,
    ).toBe(false);
    expect(result.top.profit_cents[0].value).toBe("9007199254740993");
  });

  it("never presents a zero as what worked, except for refund and chargeback rates", () => {
    const result = summarizeRankings([
      { creative_key: "sold", metric: "approved_sales", value: "3", rank: 1, percentile: 0 },
      { creative_key: "silent", metric: "approved_sales", value: "0", rank: 2, percentile: 1 },
      { creative_key: "silent", metric: "ctr", value: "4", rank: 1, percentile: 0 },
      { creative_key: "clean", metric: "refund_rate", value: "0", rank: 1, percentile: 0 },
      { creative_key: "sold", metric: "profit_cents", value: "500", rank: 1, percentile: 0 },
      { creative_key: "loss", metric: "profit_cents", value: "-200", rank: 2, percentile: 1 },
    ]);
    expect(result.top.approved_sales.map((r) => r.creative_key)).toEqual(["sold"]);
    expect(result.top.profit_cents.map((r) => r.creative_key)).toEqual(["sold"]);
    expect(result.top.refund_rate.map((r) => r.creative_key)).toEqual(["clean"]);
    const silent = result.intersections.find((r) => r.creative_key === "silent");
    expect(silent?.groups).toEqual(["ctr"]);
    expect(silent?.attentionStrongSalesWeak).toBe(true);
  });

  // With four creatives every one was in the top five, so a 90% refund rate was listed as what worked.
  it("lists a refund rate as what worked only when it is zero or no worse than the average", () => {
    const rate = (creative_key: string, value: string, rank: number, percentile: number) =>
      ({ creative_key, metric: "refund_rate", value, rank, percentile });

    const result = summarizeRankings([
      rate("clean", "0", 1, 0),
      rate("low", "0.02", 2, 1 / 3),
      rate("high", "0.4", 3, 2 / 3),
      rate("worst", "0.9", 4, 1),
    ]);
    const alone = summarizeRankings([rate("only", "0.9", 1, 0)]);

    expect(result.top.refund_rate.map((r) => r.creative_key)).toEqual(["clean", "low"]);
    expect(alone.top.refund_rate).toBeUndefined();
  });
});
