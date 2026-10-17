import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createBatchThroughChat, signUp } from "./support";

test("signup, chat, batch and .docx export", async ({ page }) => {
  await signUp(page);
  const { batchLink } = await createBatchThroughChat(page);

  await batchLink.click();
  // Only the first script opens expanded; the second shows its title.
  await expect(page.getByText("L01-C01").first()).toBeVisible();
  await expect(page.getByText(/Roteiro de teste 1/).first()).toBeVisible();
  await expect(page.getByText(/Roteiro de teste 2/).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar .docx" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("leva-1.docx");
  const file = await readFile((await download.path())!);
  // A .docx is a zip archive: it must start with "PK" and carry the batch text.
  expect(file.subarray(0, 2).toString()).toBe("PK");
  expect(file.byteLength).toBeGreaterThan(1000);
});
