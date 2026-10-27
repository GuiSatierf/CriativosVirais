import { expect, test } from "@playwright/test";
import { signUp } from "./support";

test("opening a panel slides it in and leaves the conversation behind it where it was", async ({ page }) => {
  await signUp(page);
  // A CSS locator: the open dialog hides the conversation from the accessibility tree.
  const composer = page.locator("#main-content textarea");
  await expect(composer).toBeVisible();
  const before = await composer.boundingBox();

  // Records whether the panel ever rendered in its starting (hidden) state, which is what drives the slide-in.
  await page.evaluate(() => {
    const seen = { starting: false };
    Object.assign(window, { panelTransition: seen });
    new MutationObserver(() => {
      if (document.querySelector("[data-slot=sheet-content][data-starting-style]")) seen.starting = true;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.getByRole("complementary", { name: "Barra lateral" }).getByRole("link", { name: "Levas", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { panelTransition: { starting: boolean } }).panelTransition.starting)).toBe(true);
  expect(await composer.boundingBox()).toEqual(before);
});
