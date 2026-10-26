import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("a day with only a pending sale records no results, while an approved sale does", async ({ page }) => {
  const email = `pendente-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Outro checkout" }).click();
  await page.getByRole("button", { name: "Gerar conexão" }).click();
  const token = await page.getByLabel("Token", { exact: true }).inputValue();
  const secret = await page.getByLabel("Secret", { exact: true }).inputValue();

  const send = async (status: string, creativeKey: string) => {
    const body = JSON.stringify({
      event_id: `e2e-${randomUUID()}`,
      occurred_at: new Date(Date.now() - 60_000).toISOString(),
      status,
      currency: "BRL",
      revenue: 19700,
      creative_key: creativeKey,
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const response = await page.request.post("/api/ingest/events", {
      data: body,
      headers: { Authorization: `Bearer ${token}`, "X-Webhook-Signature": `sha256=${signature}`, "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(202);
  };
  const metricsOf = (creativeKey: string) =>
    testDatabase<{ sales: string | null }>(
      `select m.approved_sales::text sales from creative_metrics m join creatives c on c.id = m.creative_id
       where c.creative_key = $2 and m.tenant_id = (select tenant_id from tenant_members where user_id = (select id from "user" where email = $1))`,
      [email, creativeKey],
    );

  // The worker runs one sale at a time, so once the approved one shows up the pending one was handled.
  await send("pending", "L09-C01");
  await send("approved", "L09-C02");
  await expect.poll(async () => (await metricsOf("L09-C02")).map((row) => row.sales), { timeout: 60_000 }).toEqual(["1"]);
  expect(await metricsOf("L09-C01")).toEqual([]);
});
