import { describe, expect, it } from "vitest";
import { pollDelay } from "./polling";

describe("polling delay", () => {
  it("keeps the base interval for a minute, then backs off up to 30 seconds", () => {
    expect(pollDelay(0, 3_000)).toBe(3_000);
    expect(pollDelay(59_000, 3_000)).toBe(3_000);
    expect(pollDelay(60_000, 3_000)).toBe(6_000);
    expect(pollDelay(3 * 60_000, 5_000)).toBe(30_000);
    expect(pollDelay(60 * 60_000, 5_000)).toBe(30_000);
  });
});
