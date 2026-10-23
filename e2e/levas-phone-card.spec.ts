import { expect, test } from "@playwright/test";
import { createBatchThroughChat, signUp } from "./support";

// On a phone a long leva title must be cut with an ellipsis inside the card, never widen
// the card past the screen and hide its arrow and date.
test("a leva card fits the phone screen", async ({ page }) => {
  await signUp(page);
  await createBatchThroughChat(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/levas");
  const card = page.getByRole("list").getByRole("link").first();
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  expect(box, "card box").not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
});
