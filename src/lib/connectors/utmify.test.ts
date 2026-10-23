import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderRejectedError } from "../errors";
import { UtmifyConnector } from "./utmify";

const connector = new UtmifyConnector({ apiKey: "chave-de-teste-123", dashboardId: "6adabde42df49187df7c276e" });

function answer(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

async function refusal() {
  const error = await connector.sync("2026-10-01", "2026-10-23").catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ProviderRejectedError);
  return (error as Error).message;
}

describe("UTMify summary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the known totals when the answer has unexpected or missing values", async () => {
    answer(200, { currency: "BRL", viewType: "Faturamento Normal", revenue: { gross: 12345, net: "?" }, ads: { spend: 5000 } });
    const { summary } = await connector.sync("2026-10-01", "2026-10-23");
    expect(summary.revenue).toEqual({ gross: 12345, net: null });
    expect(summary.ads.spend).toBe(5000);
    expect(summary.result).toEqual({});
  });

  it("refuses a dashboard that is not in reais with a clear message", async () => {
    answer(200, { currency: "USD" });
    expect(await refusal()).toContain("não está em reais");
  });
});

describe("UTMify refusals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells the user what to fix instead of a generic failure", async () => {
    answer(401);
    expect(await refusal()).toContain("Avançado → API Oficial → Novo Token");
    answer(403, { code: "OFFICIAL_API_NOT_AVAILABLE_FOR_USER" });
    expect(await refusal()).toContain("Monster, Scale ou Enterprise");
    answer(403, { code: "API_KEY_HAS_NO_ACCESS_TO_DASHBOARD" });
    expect(await refusal()).toContain("não tem acesso a este dashboard");
    answer(404);
    expect(await refusal()).toContain("Confira o ID");
  });
});
