import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A refused import used a toast that sat on top of the Importar button.
const csv = ["utm_content,gasto,vendas", "L01-C01,-10,1"].join("\n");

test("a refused CSV import explains itself next to the import button", async ({ page }) => {
  await signUp(page);
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await page.getByRole("button", { name: "Importar", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Linha" })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
});
