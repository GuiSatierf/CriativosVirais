import { afterEach, describe, expect, it, vi } from "vitest";
import { aiBudgetEnv } from "./env";

describe("AI budget configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falls back to the default when the limit is blank, instead of blocking every AI call", () => {
    vi.stubEnv("AI_MONTHLY_LIMIT_CENTS", " ");
    expect(aiBudgetEnv().AI_MONTHLY_LIMIT_CENTS).toBe(2000);
  });
});
