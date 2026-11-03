import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createBatchThroughChat, saoPauloDay, signUp } from "./support";

test("signed webhook sale is processed by the worker and shows in the batch results", async ({ page }) => {
  await signUp(page);
  const { batchId } = await createBatchThroughChat(page);

  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Outro checkout" }).click();
  await page.getByRole("button", { name: "Gerar conexão" }).click();
  const token = await page.getByLabel("Token", { exact: true }).inputValue();
  const secret = await page.getByLabel("Secret", { exact: true }).inputValue();
  expect(token.length).toBeGreaterThan(30);

  const body = JSON.stringify({
    event_id: `e2e-${randomUUID()}`,
    occurred_at: new Date(Date.now() - 60_000).toISOString(),
    status: "approved",
    currency: "BRL",
    revenue: 19700,
    profit: 14700,
    creative_key: "L01-C01",
    utm_campaign: "lancamento",
    utm_content: "L01-C01",
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const accepted = await page.request.post("/api/ingest/events", {
    data: body,
    headers: { Authorization: `Bearer ${token}`, "X-Webhook-Signature": `sha256=${signature}`, "Content-Type": "application/json" },
  });
  expect(accepted.status()).toBe(202);

  const today = saoPauloDay();
  const results = `/api/batches/${batchId}/results?${new URLSearchParams({ from: today, to: today, source: "webhook" })}`;
  // The sale reaches the batch only after the worker processes the ingest-event job.
  await expect
    .poll(async () => {
      const response = await page.request.get(results);
      const data = await response.json();
      const row = data.items?.find((item: { creativeKey: string }) => item.creativeKey === "L01-C01");
      return row?.metrics?.approved_sales ?? null;
    }, { timeout: 60_000 })
    .toBe("1");

  await page.goto(`/levas/${batchId}`);
  await page.getByRole("tab", { name: "Resultados" }).click();
  await page.getByRole("button", { name: "Vendas do checkout" }).click();
  await expect(page.getByText("1 de 2 roteiros com resultados")).toBeVisible();
});
