import { expect, test, type Page } from "@playwright/test";
import { sendMessage, signUp } from "./support";

// Opening a card as a panel let the chat scroller grow to its content, which reset it to the top;
// closing the panel must bring the reader back to where they were.
async function longConversation(page: Page) {
  await signUp(page);
  for (let index = 1; index <= 8; index++)
    await sendMessage(page, `Pergunta de teste ${index}: como melhorar meus anúncios?`);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  const scroller = page.locator('#main-content [class*="overscroll-contain"]').first();
  await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  return scroller;
}

async function openAndCloseOfferPanel(page: Page) {
  // A dispatched click opens the card without Playwright scrolling it into view first.
  await page.getByRole("link", { name: /Anotei na sua oferta/ }).last().dispatchEvent("click");
  await expect(page).toHaveURL(/\/configuracoes$/);
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page).toHaveURL(/\/chat\//);
}

test("closing a panel keeps the conversation at the latest messages", async ({ page }) => {
  const scroller = await longConversation(page);
  const distanceFromBottom = () =>
    scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);
  await expect.poll(distanceFromBottom).toBeLessThan(2);

  await openAndCloseOfferPanel(page);

  await expect.poll(distanceFromBottom).toBeLessThan(2);
});

test("closing a panel keeps a reader who scrolled up at the same place", async ({ page }) => {
  const scroller = await longConversation(page);
  await scroller.evaluate((element) => element.scrollTo({ top: 200, behavior: "instant" }));
  await expect.poll(() => scroller.evaluate((element) => Math.round(element.scrollTop))).toBe(200);

  await openAndCloseOfferPanel(page);

  await expect.poll(() => scroller.evaluate((element) => Math.round(element.scrollTop))).toBe(200);
});
