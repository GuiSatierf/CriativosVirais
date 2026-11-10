import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("team members reach the panel from the top bar, clients never see the shortcut", async ({ page }) => {
  const email = `equipe-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const shortcut = page.getByRole("banner").getByRole("link", { name: "Painel Admin" });

  // A client account has no way into the panel.
  await expect(page.getByRole("banner").getByRole("link", { name: "Levas" })).toBeVisible();
  await expect(shortcut).toHaveCount(0);

  // The same account on the team gets the shortcut first in the bar, and it opens the panel.
  await testDatabase(`update "user" set role = 'support', two_factor_enabled = true where email = $1`, [email]);
  await page.reload();
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.getByRole("heading", { name: "Painel do suporte" })).toBeVisible();
});

// On a phone the role badge sat on top of the back link and the header ran past the screen.
test("the panel header fits a phone without the role badge covering the back link", async ({ page }) => {
  const email = `equipe-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  await testDatabase(`update "user" set role = 'support', two_factor_enabled = true where email = $1`, [email]);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel do suporte" })).toBeVisible();
  const banner = page.getByRole("banner");
  const badge = await banner.getByText("Suporte", { exact: true }).boundingBox();
  const back = await banner.getByRole("link", { name: "Voltar ao app", exact: true }).boundingBox();
  const signOut = await banner.getByRole("button", { name: "Sair" }).boundingBox();

  if (badge == null || back == null || signOut == null) throw new Error("A header element has no box on screen.");
  const overlaps =
    badge.x < back.x + back.width && back.x < badge.x + badge.width &&
    badge.y < back.y + back.height && back.y < badge.y + badge.height;
  expect(overlaps).toBe(false);
  expect(signOut.x + signOut.width).toBeLessThanOrEqual(375);
});
