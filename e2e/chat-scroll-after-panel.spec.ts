import { expect, test } from "@playwright/test";
import { sendMessage, signUp } from "./support";

// Opening a card as a panel let the chat scroller grow to its content, which reset it to the top;
// closing the panel must bring the reader back to the latest messages.
test("closing a panel keeps the conversation at the latest messages", async ({ page }) => {
  await signUp(page);
  for (let index = 1; index <= 8; index++)
    await sendMessage(page, `Pergunta de teste ${index}: como melhorar meus anúncios?`);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");

  const scroller = page.locator('#main-content [class*="overscroll-contain"]').first();
  const distanceFromBottom = () =>
    scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);
  await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect.poll(distanceFromBottom).toBeLessThan(2);

  await page.getByRole("link", { name: /Anotei na sua oferta/ }).last().click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page).toHaveURL(/\/chat\//);

  await expect.poll(distanceFromBottom).toBeLessThan(2);
});
