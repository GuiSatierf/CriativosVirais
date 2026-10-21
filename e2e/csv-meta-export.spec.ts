import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// Ads Manager exports name the code column "Nome do anúncio"; the guess must not leave
// the required creative code empty and the import button dead.
const metaExport = [
  "Nome do anúncio;Valor usado (BRL);Compras;Valor de conversão da compra",
  "L01-C01;450,00;9;1773,00",
  "L01-C02;380,00;4;788,00",
].join("\n");

test("an Ads Manager export maps the ad name to the creative code", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "meta.csv", mimeType: "text/csv", buffer: Buffer.from(metaExport) });
  await expect(page.locator("#csv-creative_key")).toHaveText("Nome do anúncio");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("2 criativos importados.")).toBeVisible();
});

test("without a code column the import says which column is missing", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "totais.csv", mimeType: "text/csv", buffer: Buffer.from("Valor usado (BRL);Compras\n450,00;9") });
  await expect(page.getByText("Escolha a coluna do código do criativo.")).toBeVisible();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.locator("#csv-creative_key")).toBeFocused();
});
