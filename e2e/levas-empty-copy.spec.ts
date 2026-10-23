import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// The empty Levas page defined a leva twice, in the subtitle and in the empty state.
test("the empty Levas page defines a leva only once", async ({ page }) => {
  await signUp(page);
  await page.goto("/levas");
  await expect(page.getByText("Nenhuma leva ainda")).toBeVisible();
  await expect(page.getByText(/conjunto de roteiros/)).toHaveCount(1);
});
