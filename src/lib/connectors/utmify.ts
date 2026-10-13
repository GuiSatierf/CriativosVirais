import { z } from "zod";
import { RetryLaterError } from "../errors";
import type { Connector } from "./types";
export const utmifyCredentials = z.object({
  apiKey: z.string().min(10).max(500),
  dashboardId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});
const n = z.number().int().safe().nullable().optional();
const summarySchema = z.object({
  currency: z.literal("BRL"),
  viewType: z.enum(["Total", "Normal"]),
  orders: z.object({ approved: n, refunded: n, chargedback: n }),
  revenue: z.object({ gross: n, net: n }),
  ads: z.object({ spend: n, clicks: n, leads: n, initiateCheckouts: n }),
  result: z.object({
    profit: n,
    roas: z.number().finite().nullable().optional(),
  }),
});
// Official read API provides consolidated dashboards, not a documented utm_content breakdown.
export class UtmifyConnector implements Connector {
  constructor(private credentials: z.infer<typeof utmifyCredentials>) {
    utmifyCredentials.parse(credentials);
  }
  async sync(from: string, to: string) {
    const response = await fetch(
      `https://query-api.utmify.com.br/public-api/v1/dashboards/${this.credentials.dashboardId}/summary`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from + "T00:00:00-03:00",
          to: to + "T23:59:59-03:00",
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after"));
      const delay =
        Number.isFinite(seconds) && seconds > 0
          ? Math.min(86400, Math.max(60, seconds))
          : 60;
      throw new RetryLaterError(
        new Date(Date.now() + delay * 1000).toISOString(),
      );
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "UTMify: limite temporário. Aguarde a próxima sincronização."
          : "UTMify: verifique plano, acesso beta, dashboard e chave.",
      );
    const summary = summarySchema.parse(await response.json());
    return {
      records: [],
      summary: { ...summary, period: { from, to } },
      warning:
        "A API oficial retorna resumo consolidado. O ranking por criativo precisa de CSV ou webhook com creative_key/utm_content.",
    };
  }
}
