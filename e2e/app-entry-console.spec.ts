import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// Entering the app logged a React error for the inline script and a Next warning for smooth scrolling.
test("entering the app logs no script or scroll-behavior warning", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));

  await signUp(page);
  await page.goto("/login");
  await page.goto("/chat");
  await expect(page.getByPlaceholder("Escreva para o Estrategista…")).toBeVisible();

  expect(messages.filter((text) => /script tag|scroll-behavior/i.test(text))).toEqual([]);
});
