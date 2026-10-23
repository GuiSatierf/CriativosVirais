import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// Ads named "L01-C02 | dor" or "l01-c03" are kept as typed, so their results never reach the
// batch's scripts (the match is exact and case-sensitive): the import must say so first.
const csv = ["nome do anúncio,gasto,vendas", "L01-C02 | dor,100,2", "l01-c03,30,1", "L01-C01,50,1"].join("\n");

test("the CSV import warns about names that are not exactly a batch code", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText("2 nomes não são exatamente o código da leva, como “L01-C02 | dor”.")).toBeVisible();
});
