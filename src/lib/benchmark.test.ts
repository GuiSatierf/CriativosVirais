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
});
