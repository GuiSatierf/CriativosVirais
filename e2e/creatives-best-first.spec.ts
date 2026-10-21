import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// "Ver o que funcionou" opens Resultados: the best sellers come first, not the
// alphabetical order of the codes. AD-B sells 9 + 1 in two campaigns, so it ranks
// first by its total and its rows stay together.
const csv = [
  "utm_content,campanha,gasto,vendas,receita",
  "AD-A,lancamento,410,1,197",
  "AD-B,lancamento,400,9,1773",
  "AD-B,perpetuo,100,1,197",
  "AD-C,lancamento,380,5,985",
].join("\n");

test("results list the best-selling creatives first", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText(/criativos? importados?\./)).toBeVisible();

  await page.goto("/criativos");
  const rows = page.getByRole("region", { name: "Tabela de criativos" }).getByRole("row").filter({ hasText: /AD-[ABC]/ });
  await expect(rows).toHaveCount(4);
  for (const [index, key] of ["AD-B", "AD-B", "AD-C", "AD-A"].entries())
    await expect(rows.nth(index)).toContainText(key);
});
