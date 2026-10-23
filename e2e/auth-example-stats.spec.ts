import { expect, test } from "@playwright/test";

// The sign-in illustration uses made-up numbers; they must read as examples, not as results.
test("the sign-in illustration labels its numbers as examples", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  const panel = page.getByRole("region", { name: "Sobre o Criativos Virais" });
  await expect(panel.getByText("Exemplo: melhor criativo")).toBeVisible();
  await expect(panel.getByText("Exemplo: últimos 7 dias")).toBeVisible();
});
