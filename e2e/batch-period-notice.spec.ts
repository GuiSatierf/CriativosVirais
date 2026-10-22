import { expect, test } from "@playwright/test";
import { createBatchThroughChat, signUp } from "./support";

// The leva's Resultados tab reads the same spreadsheet as Resultados: dates other than the
// imported period must say so and lead back to it instead of "import the spreadsheet".
const csv = ["utm_content,gasto,vendas,receita", "L01-C01,400,9,1773"].join("\n");

test("the batch results tab offers the imported period for other dates", async ({ page }) => {
  await signUp(page);
  const { batchId } = await createBatchThroughChat(page);

  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("1 criativo importado.")).toBeVisible();

  await page.goto(`/levas/${batchId}`);
  await page.getByRole("tab", { name: "Resultados" }).click();
  await expect(page.getByText("1 de 2 roteiros com resultados")).toBeVisible();

  // One day later as the start date: still inside the import, but not its exact period.
  await page.getByRole("button", { name: "Data inicial" }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Não há planilha importada para este período")).toBeVisible();
  await expect(page.getByText("Ainda sem resultados nesta leva")).toBeHidden();

  await page.getByRole("button", { name: /^Ver \d{2}\/\d{2}\/\d{4} a / }).click();
  await expect(page.getByText("1 de 2 roteiros com resultados")).toBeVisible();
  await expect(page.getByText("Não há planilha importada para este período")).toBeHidden();
});
