import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// The offer form called the assistant "assistente" while the rest of the app says "Estrategista".
test("the offer form names the Estrategista", async ({ page }) => {
  await signUp(page);
  await page.goto("/configuracoes");
  await expect(page.getByText("e o Estrategista preenche para você.", { exact: false })).toBeVisible();
  await expect(page.getByText("assistente", { exact: false })).toHaveCount(0);
});

// A refused price kept the "Salvo" badge and only warned on Continuar, with the wrong reason for huge values.
test("a refused price is flagged next to the field while typing and never shows as saved", async ({ page }) => {
  await signUp(page);
  await page.goto("/configuracoes");
  await page.getByLabel("Qual é o nome do produto?").fill("Curso de teste");
  await page.getByRole("button", { name: "Continuar" }).click();
  const price = page.getByLabel("Quanto custa?");

  await price.fill("-50");
  await expect(page.getByText("O preço não pode ser negativo.", { exact: false })).toBeVisible();
  await expect(page.getByText("Não salvo")).toBeVisible();
  await price.fill("99999999999999999999");
  await expect(page.getByText("Esse valor é alto demais.", { exact: false })).toBeVisible();
  await expect(page.getByText("Não salvo")).toBeVisible();
  await price.fill("197");

  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect(page.getByText("Não salvo")).toBeHidden();
});
