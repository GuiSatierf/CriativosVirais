import { z } from "zod";
import { ProviderRejectedError, RetryLaterError } from "../errors";
export const utmifyCredentials = z.object({
  apiKey: z.string().trim().min(10).max(500),
  dashboardId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/),
});
// The documentation lists the fields but not every value; an unexpected one becomes "unknown"
// (NULL) instead of failing the whole sync, and a missing group reads as all unknown.
const n = z.number().int().nullable().optional().catch(null);
const summarySchema = z.object({
  currency: z.string(),
  viewType: z.string().optional().catch(undefined),
  orders: z.object({ approved: n, refunded: n, chargedback: n }).default({}).catch({}),
  revenue: z.object({ gross: n, net: n }).default({}).catch({}),
  ads: z.object({ spend: n, clicks: n, leads: n, initiateCheckouts: n }).default({}).catch({}),
  result: z
    .object({ profit: n, roas: z.number().nullable().optional().catch(null) })
    .default({})
    .catch({}),
});
const newTokenHint = "Crie um token em Avançado → API Oficial → Novo Token e conecte de novo.";

/** What the user can do about each refusal documented by the UTMify query API. */
async function rejection(response: Response) {
  if (response.status === 401) return `A UTMify recusou a chave. ${newTokenHint}`;
  if (response.status === 404) return "A UTMify não encontrou este dashboard. Confira o ID no endereço do dashboard.";
  if (response.status !== 403) return null;
  const body: unknown = await response.json().catch(() => null);
  const code = typeof body === "object" && body !== null && "code" in body ? body.code : null;
  if (code === "API_KEY_HAS_NO_ACCESS_TO_DASHBOARD")
    return `Este token não tem acesso a este dashboard. ${newTokenHint}`;
  return "A UTMify não liberou a API Oficial para esta conta. Ela exige plano Monster, Scale ou Enterprise e acesso ao beta da API.";
}

// Official read API provides consolidated dashboards, not a documented utm_content breakdown.
export class UtmifyConnector {
  constructor(private credentials: z.infer<typeof utmifyCredentials>) {}
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
      const header = response.headers.get("retry-after");
      const seconds = Number(header);
      const now = Date.now();
      const requested = Number.isFinite(seconds) && seconds > 0
        ? now + seconds * 1000 : Date.parse(header ?? "");
      // At least a minute, at most a day: a huge Retry-After must not silence syncing for weeks.
      const retryAt = Number.isFinite(requested) && requested <= 8.64e15
        ? Math.min(Math.max(now + 60_000, requested), now + 86_400_000) : now + 60_000;
      throw new RetryLaterError("UTMify", new Date(retryAt).toISOString());
    }
    const refused = await rejection(response);
    if (refused != null) throw new ProviderRejectedError(refused);
    if (!response.ok)
      throw Object.assign(new Error("UTMify request failed"), {
        statusCode: response.status,
      });
    const summary = summarySchema.parse(await response.json());
    // Reports are in reais; another currency would mix units with the client's other data.
    if (summary.currency !== "BRL")
      throw new ProviderRejectedError("Este dashboard da UTMify não está em reais. Use um dashboard em real brasileiro (R$).");
    return {
      records: [],
      summary: { ...summary, period: { from, to } },
      warning:
        "A API oficial retorna resumo consolidado. O ranking por criativo precisa de CSV ou webhook com creative_key/utm_content.",
    };
  }
}
