import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// An ad named "L01-C02 | dor" is kept as typed, so its results never reach script L01-C02:
// the import must say so before the client imports it.
const csv = ["nome do anúncio,gasto,vendas", "L01-C02 | dor,100,2", "L01-C01,50,1"].join("\n");

test("the CSV import warns about names with text beyond the batch code", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText("1 nome tem texto além do código da leva, como “L01-C02 | dor”.")).toBeVisible();
});
