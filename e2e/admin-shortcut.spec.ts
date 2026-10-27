import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("team members reach the panel from the left bar, clients never see the shortcut", async ({ page }) => {
  const email = `equipe-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const bar = page.getByRole("complementary", { name: "Barra lateral" });
  const shortcut = bar.getByRole("link", { name: "Painel Admin" });

  // A client account has no way into the panel.
  await expect(bar.getByRole("link", { name: "Levas", exact: true })).toBeVisible();
  await expect(shortcut).toHaveCount(0);

  // The same account on the team gets the shortcut with the other areas, and it opens the panel.
  await testDatabase(`update "user" set role = 'support', two_factor_enabled = true where email = $1`, [email]);
  await page.reload();
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.getByRole("heading", { name: "Painel do suporte" })).toBeVisible();
});
