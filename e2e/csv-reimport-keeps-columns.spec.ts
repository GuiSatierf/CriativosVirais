import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

const period = { from: "2026-10-01", to: "2026-10-15", decimal: "comma", moneyUnit: "major", metricDefinitions: {} };

test("a second sheet for the same period adds its columns instead of erasing the first sheet's", async ({ page, baseURL }) => {
  const email = `planilhas-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const send = (csv: string, mapping: Record<string, string>) =>
    page.request.post("/api/metrics/import", { data: { ...period, csv, mapping }, headers: { Origin: baseURL! } });

  // The Meta export brings spend and impressions; the checkout sheet brings sales and revenue.
  expect((await send("anuncio;gasto;impressoes\nL01-C01;400;10000", { creative_key: "anuncio", spend_cents: "gasto", impressions: "impressoes" })).status()).toBe(200);
  const second = await send("anuncio;vendas;receita\nL01-C01;9;1773", { creative_key: "anuncio", approved_sales: "vendas", revenue_cents: "receita" });
  expect(second.status()).toBe(200);
  expect((await second.json()).imported).toBe(1);

  const [metrics] = await testDatabase<{ spend: string | null; impressions: string | null; sales: string | null; revenue: string | null }>(
    `select m.spend_cents::text spend, m.impressions::text impressions, m.approved_sales::text sales, m.revenue_cents::text revenue
     from creative_metrics m join creatives c on c.id = m.creative_id
     where c.creative_key = 'L01-C01' and m.tenant_id = (select tenant_id from tenant_members where user_id = (select id from "user" where email = $1))`,
    [email],
  );
  expect(metrics).toEqual({ spend: "40000", impressions: "10000", sales: "9", revenue: "177300" });
});

test("a sheet that names the campaign keeps the columns of the earlier campaign-less sheet", async ({ page, baseURL }) => {
  const email = `campanha-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const send = (csv: string, mapping: Record<string, string>) =>
    page.request.post("/api/metrics/import", { data: { ...period, csv, mapping }, headers: { Origin: baseURL! } });

  expect((await send("anuncio;gasto\nL01-C01;400", { creative_key: "anuncio", spend_cents: "gasto" })).status()).toBe(200);
  const second = await send("anuncio;campanha;vendas\nL01-C01;Lançamento;9", {
    creative_key: "anuncio",
    campaign_key: "campanha",
    approved_sales: "vendas",
  });
  expect(second.status()).toBe(200);

  const rows = await testDatabase<{ campaign: string; spend: string | null; sales: string | null }>(
    `select m.campaign_key campaign, m.spend_cents::text spend, m.approved_sales::text sales
     from creative_metrics m join creatives c on c.id = m.creative_id
     where c.creative_key = 'L01-C01' and m.tenant_id = (select tenant_id from tenant_members where user_id = (select id from "user" where email = $1))`,
    [email],
  );
  expect(rows).toEqual([{ campaign: "Lançamento", spend: "40000", sales: "9" }]);
});
