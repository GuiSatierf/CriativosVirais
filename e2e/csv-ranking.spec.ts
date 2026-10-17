import { expect, test } from "@playwright/test";
import { saoPauloDay, signUp } from "./support";

// Integer values avoid depending on the decimal separator chosen in the form.
const csv = [
  "utm_content,gasto,vendas,receita",
  "AD-FORTE,400,9,1773",
  "AD-MEDIO,380,4,788",
  "AD-FRACO,410,1,197",
].join("\n");

test("CSV import feeds the creatives table and the internal ranking", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("3 criativos importados.")).toBeVisible();

  // The form imports the last 30 days by default.
  const period = { from: saoPauloDay(new Date(Date.now() - 30 * 86_400_000)), to: saoPauloDay(), source: "csv" };
  await page.goto(`/criativos?${new URLSearchParams(period)}`);
  const table = page.getByRole("region", { name: "Tabela de criativos" });
  for (const key of ["AD-FORTE", "AD-MEDIO", "AD-FRACO"])
    await expect(table.getByRole("row").filter({ hasText: key })).toBeVisible();

  const response = await page.request.get(`/api/metrics/benchmark?${new URLSearchParams(period)}`);
  expect(response.status()).toBe(200);
  const { top } = await response.json();
  expect(top.revenue_cents.map((row: { creative_key: string }) => row.creative_key)).toEqual(["AD-FORTE", "AD-MEDIO", "AD-FRACO"]);
  expect(top.revenue_cents[0].value).toBe("177300");
});
