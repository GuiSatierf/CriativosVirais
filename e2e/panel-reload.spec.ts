import { expect, test } from "@playwright/test";
import { sendMessage, signUp } from "./support";

// Reloading with a panel open used to bring the panel back as a page of its own, and closing
// it then started a new conversation instead of returning to the one behind the panel.
test("reloading an open panel keeps it over the same conversation", async ({ page }) => {
  await signUp(page);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  const conversationUrl = page.url();
  await page.getByRole("link", { name: "Levas" }).first().click();
  await expect(page).toHaveURL(/\/levas$/);
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/levas$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page).toHaveURL(conversationUrl);
  await expect(
    page.getByRole("region", { name: "Mensagens da conversa" }).getByText("Eu vendo um curso de rotina"),
  ).toBeVisible();
});

// The reopened panel used to flash as a full page for a moment before it went back over the conversation.
test("a reloaded panel is not shown as a full page before it reopens", async ({ page }) => {
  await signUp(page);
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  await page.getByRole("link", { name: "Levas" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Holding the app's scripts keeps the server-rendered page on screen, as on a slow connection.
  const { promise: scriptsHeld, resolve: releaseScripts } = Promise.withResolvers<void>();
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
    await scriptsHeld;
    await route.continue();
  });

  await page.reload({ waitUntil: "commit" });

  const fullPage = page.locator("#main-content");
  await expect(fullPage).toBeAttached();
  await expect(fullPage).toBeHidden();
  releaseScripts();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(fullPage).toBeVisible();
});
