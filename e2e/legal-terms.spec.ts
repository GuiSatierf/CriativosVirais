import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { grantAccess, testDatabase, testPassword, waitForSignUpSlot } from "./support";

test("sign-up needs no terms acceptance and the hidden legal pages open only by address", async ({ page }) => {
  // The draft pages still open by address, out of search engines.
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "Termos de uso" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: "Política de privacidade" })).toBeVisible();

  // Nothing on the sign-in or sign-up screens leads there.
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(page.locator('a[href="/termos"], a[href="/privacidade"]')).toHaveCount(0);
    await expect(page.getByText(/Li e aceito/)).toHaveCount(0);
  }

  // A granted email signs up with name, email and password only, and each access is still recorded.
  const email = `termos-${randomUUID()}@exemplo.test`;
  await grantAccess(email);
  await waitForSignUpSlot();
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Conta Sem Aceite");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

  const [account] = await testDatabase<{ id: string }>(`select id from "user" where email = $1`, [email]);
  const accesses = await testDatabase(`select 1 from access_log where user_id = $1`, [account.id]);
  expect(accesses.length).toBeGreaterThan(0);

  // An account that never accepted anything goes straight to the chat.
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/chat/);
});
