import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("the panel has a way back to the app", async ({ page }) => {
  const email = `equipe-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  await testDatabase(`update "user" set role = 'support', two_factor_enabled = true where email = $1`, [email]);

  await page.goto("/admin");
  await page.getByRole("banner").getByRole("link", { name: "Voltar ao app", exact: true }).click();
  await expect(page).toHaveURL(/\/chat/);
});
