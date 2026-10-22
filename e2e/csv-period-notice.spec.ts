import { expect, test } from "@playwright/test";
import { saoPauloDay, signUp } from "./support";

// A spreadsheet answers only for the exact period it was imported with; any other
// window must say so and lead back to the imported period instead of empty rows.
const csv = ["utm_content,gasto,vendas,receita", "AD-PERIODO,400,9,1773"].join("\n");

test("a period without a spreadsheet offers the imported one", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("1 criativo importado.")).toBeVisible();

  // The form imports the last 30 days by default; the last 7 days sit inside it.
  const week = { from: saoPauloDay(new Date(Date.now() - 7 * 86_400_000)), to: saoPauloDay(), source: "csv" };
  await page.goto(`/criativos?${new URLSearchParams(week)}`);
  await expect(page.getByText("Não há planilha importada para este período")).toBeVisible();

  await page.getByRole("button", { name: /^Ver \d{2}\/\d{2}\/\d{4} a / }).click();
  const table = page.getByRole("region", { name: "Tabela de criativos" });
  await expect(table.getByRole("row").filter({ hasText: "AD-PERIODO" })).toContainText("R$ 1.773,00");
  await expect(page.getByText("Não há planilha importada para este período")).toBeHidden();
});
