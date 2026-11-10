import { expect, test } from "@playwright/test";
import { minPasswordLength } from "../src/lib/password-rules";
import { signUp, testPassword } from "./support";

test("the profile accepts a new password as short as sign-up does", async ({ page }) => {
  await signUp(page);
  const shortPassword = "a".repeat(minPasswordLength);

  await page.goto("/perfil");
  await page.getByLabel("Senha atual").fill(testPassword);
  await page.getByLabel("Nova senha", { exact: true }).fill(shortPassword);
  await page.getByLabel("Confirme a nova senha").fill(shortPassword);
  await page.getByRole("button", { name: "Trocar senha" }).click();

  await expect(page.getByText("Senha alterada.", { exact: false })).toBeVisible();
  await expect(page.getByText(`Pelo menos ${minPasswordLength} caracteres.`)).toBeVisible();
});
