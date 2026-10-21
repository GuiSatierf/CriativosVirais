import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// "Ver o que funcionou" opens Resultados: the best sellers must come first, not the
// alphabetical order of the codes.
const csv = [
  "utm_content,gasto,vendas,receita",
  "AD-A,410,1,197",
  "AD-B,400,9,1773",
  "AD-C,380,4,788",
].join("\n");

test("results list the best-selling creatives first", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("3 criativos importados.")).toBeVisible();

  await page.goto("/criativos");
  const rows = page.getByRole("region", { name: "Tabela de criativos" }).getByRole("row").filter({ hasText: /AD-[ABC]/ });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("AD-B");
  await expect(rows.nth(1)).toContainText("AD-C");
  await expect(rows.nth(2)).toContainText("AD-A");
});
