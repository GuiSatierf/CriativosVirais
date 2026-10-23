import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support";

// playwright.config.ts points the app's email outbox here, so no message is really sent.
const outbox = "test-results/outbox";
const newPassword = "e2e-senha-nova-2026";

async function resetLinkFor(email: string) {
  const files = await readdir(outbox).catch(() => []);
  for (const file of [...files].sort().reverse()) {
    const message = JSON.parse(await readFile(path.join(outbox, file), "utf8"));
    if (message.to !== email) continue;
    return message.text.match(/https?:\/\/\S+\/reset-password\/\S+/)?.[0] ?? null;
  }
  return null;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("a forgotten password is replaced through the emailed link, once", async ({ page, browser }) => {
  const email = `e2e-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  // A second device that stays signed in with the old password.
  const otherDevice = await browser.newContext({ storageState: await page.context().storageState() });
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueceu a senha?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  await expect.poll(() => resetLinkFor(email)).not.toBeNull();
  const link = (await resetLinkFor(email))!;

  await page.goto(link);
  await expect(page).toHaveURL(/\/nova-senha\?token=/);
  await page.getByLabel("Nova senha").fill(newPassword);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Senha alterada. Entre com a nova senha.")).toBeVisible();

  const otherSession = await otherDevice.request.get("/api/auth/get-session");
  expect(await otherSession.json()).toBeNull();
  await otherDevice.close();

  await signIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/chat/);

  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Link vencido" })).toBeVisible();
});

test("an unknown email gets the same answer and no message", async ({ page }) => {
  const email = `ninguem-${randomUUID()}@exemplo.test`;
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  expect(await resetLinkFor(email)).toBeNull();
});
