import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

describe("sameOffer", () => {
  // Any save, even with the same answers, touched updatedAt and failed a batch already paid for.
  it("ignores the save time and compares only the answers", async () => {
    const { sameOffer } = await import("./context");
    const loaded = { id: "c1", produto: "Curso", ticketCents: 19700n, updatedAt: new Date("2026-11-10T10:00:00Z") };

    const resaved = { ...loaded, updatedAt: new Date("2026-11-10T10:05:00Z") };
    const changed = { ...resaved, ticketCents: 29700n };

    expect(sameOffer(resaved, loaded)).toBe(true);
    expect(sameOffer(changed, loaded)).toBe(false);
  });
});
