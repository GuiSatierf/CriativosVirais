import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support";

// Ads Manager exports name the code column "Nome do anúncio"; the guess must not leave
// the required creative code empty and the import button dead.
const metaExport = [
  "Nome do anúncio;Valor usado (BRL);Compras;Valor de conversão da compra",
  "L01-C01;450,00;9;1773,00",
  "L01-C02;380,00;4;788,00",
].join("\n");
const withoutCode = "Valor usado (BRL);Compras\n450,00;9";
// Ad names may carry extra words; utm_content holds the bare code and must win.
const nameAndUtm = "Nome do anúncio;utm_content;Valor usado (BRL)\nL01-C01 | dor;L01-C01;450,00";

async function chooseCsv(page: Page, name: string, csv: string) {
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
}

// One account for both cases: sign-ups in quick succession hit the auth rate limit.
test("an Ads Manager export maps the ad name to the code and a missing code is explained", async ({ page }) => {
  await signUp(page);

  await chooseCsv(page, "meta.csv", metaExport);
  await expect(page.locator("#csv-creative_key")).toHaveText("Nome do anúncio");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("2 criativos importados.")).toBeVisible();

  await chooseCsv(page, "nome-e-utm.csv", nameAndUtm);
  await expect(page.locator("#csv-creative_key")).toHaveText("utm_content");

  await chooseCsv(page, "totais.csv", withoutCode);
  await expect(page.getByText("Escolha a coluna do código do criativo.")).toBeVisible();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.locator("#csv-creative_key")).toBeFocused();
});
