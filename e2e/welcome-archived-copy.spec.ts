import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// The welcome names the Estrategista without a marketing line, and the archived list points to
// the left bar, where every conversation menu lives.
test("the welcome and archived conversations use the current wording", async ({ page }) => {
  await signUp(page);
  await expect(page.getByText("Aqui é o Estrategista.", { exact: true })).toBeVisible();

  await page.goto("/conversas/arquivadas");
  await expect(page.getByText("Use o menu de uma conversa na barra lateral para arquivá-la.")).toBeVisible();
});
