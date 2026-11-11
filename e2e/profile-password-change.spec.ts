import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { minPasswordLength } from "../src/lib/password-rules";
import { signUp, testDatabase, testPassword } from "./support";

// playwright.config.ts points the app's email outbox here, so no message is really sent.
async function confirmationLinkFor(email: string) {
  const outbox = "test-results/outbox";
  const files = await readdir(outbox).catch(() => []);
  const messages = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(outbox, file), "utf8"))));
  const message = messages.find((entry) => entry.to === email && entry.subject === "Confirme seu e-mail · Criativos Virais");
  return message?.text.match(/https?:\/\/\S+\/verify-email\?\S+/)?.[0] ?? null;
}

test("changing the password waits for a confirmed email, which the emailed link gives", async ({ page, baseURL }) => {
  const email = `e2e-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const shortPassword = "a".repeat(minPasswordLength);

  // Sign-up proves nothing about the mailbox: whoever signed up with someone else's email has only
  // the password, which must not be enough to lock the real owner out.
  const direct = await page.request.post("/api/auth/change-password", {
    data: { currentPassword: testPassword, newPassword: shortPassword },
    headers: { Origin: baseURL! },
  });
  expect(direct.status()).toBe(403);
  expect((await direct.json()).code).toBe("EMAIL_NOT_CONFIRMED");

  await page.goto("/perfil");
  await page.getByLabel("Senha atual").fill(testPassword);
  await page.getByLabel("Nova senha", { exact: true }).fill(shortPassword);
  await page.getByLabel("Confirme a nova senha").fill(shortPassword);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Para sua segurança, confirme seu e-mail antes.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Enviar link de confirmação" }).click();
  await expect(page.getByText(`Enviamos um link para ${email}`, { exact: false })).toBeVisible();

  // The mailbox owner opens the link and comes back to the profile with the email confirmed.
  await expect.poll(() => confirmationLinkFor(email)).not.toBeNull();
  await page.goto((await confirmationLinkFor(email))!);
  await expect(page).toHaveURL(/\/perfil/);
  const [confirmed] = await testDatabase<{ email_verified: boolean }>(`select email_verified from "user" where email = $1`, [email]);
  expect(confirmed.email_verified).toBe(true);

  // The profile accepts a new password as short as sign-up does.
  await page.getByLabel("Senha atual").fill(testPassword);
  await page.getByLabel("Nova senha", { exact: true }).fill(shortPassword);
  await page.getByLabel("Confirme a nova senha").fill(shortPassword);
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha alterada.", { exact: false })).toBeVisible();
  await expect(page.getByText(`Pelo menos ${minPasswordLength} caracteres.`)).toBeVisible();
});
