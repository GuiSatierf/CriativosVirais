import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// The offer form called the assistant "assistente" while the rest of the app says "Estrategista".
test("the offer form names the Estrategista", async ({ page }) => {
  await signUp(page);
  await page.goto("/configuracoes");
  await expect(page.getByText("e o Estrategista preenche para você.", { exact: false })).toBeVisible();
  await expect(page.getByText("assistente", { exact: false })).toHaveCount(0);
});
