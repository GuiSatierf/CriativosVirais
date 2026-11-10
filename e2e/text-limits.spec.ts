import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A pasted name longer than the field allowed was cut at the limit without a word.
test("the profile name says when it reached its character limit", async ({ page }) => {
  await signUp(page);
  await page.goto("/perfil");

  await page.getByLabel("Nome", { exact: true }).fill("a".repeat(150));

  await expect(page.getByText("Limite de 100 caracteres atingido.")).toBeVisible();
});
