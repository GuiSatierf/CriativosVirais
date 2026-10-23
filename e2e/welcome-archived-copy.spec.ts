import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// The welcome names the Estrategista without a marketing line, and the archived list points to
// the Histórico drawer, since the app has no sidebar.
test("the welcome and archived conversations use the current wording", async ({ page }) => {
  await signUp(page);
  await expect(page.getByText("Aqui é o Estrategista.", { exact: true })).toBeVisible();

  await page.goto("/conversas/arquivadas");
  await expect(page.getByText("Use o menu de uma conversa no Histórico para arquivá-la.")).toBeVisible();
  await expect(page.getByText("barra lateral")).toHaveCount(0);
});
