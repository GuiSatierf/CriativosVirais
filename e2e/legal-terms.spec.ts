import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { grantAccess, testDatabase, testPassword } from "./support";

test("sign-up requires accepting the terms, records it with each access, and older accounts accept once", async ({ page }) => {
  // The pages are public.
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "Termos de uso" })).toBeVisible();
  await expect(page.getByText("rascunho em revisão", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page.getByRole("heading", { name: "Política de privacidade" })).toBeVisible();

  // Without the box the account is not created, even if the request skips the form.
  const email = `termos-${randomUUID()}@exemplo.test`;
  await grantAccess(email);
  const direct = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Sem aceite", email, password: testPassword },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(direct.status()).toBe(400);
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Conta Termos");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Aceite os termos para continuar.")).toBeVisible();
  await page.getByLabel(/Li e aceito os/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

  const [account] = await testDatabase<{ id: string }>(`select id from "user" where email = $1`, [email]);
  const accepted = await testDatabase(`select version from legal_acceptances where user_id = $1`, [account.id]);
  expect(accepted).toEqual([{ version: 1 }]);
  const accesses = await testDatabase<{ ip_address: string | null }>(`select ip_address from access_log where user_id = $1`, [account.id]);
  expect(accesses.length).toBeGreaterThan(0);

  // An account from before the terms is sent to accept them once, then goes on as usual.
  await testDatabase(`delete from legal_acceptances where user_id = $1`, [account.id]);
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/aceitar-termos$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Aceite os termos para continuar.")).toBeVisible();
  await page.getByLabel(/Li e aceito os/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/chat/);
  await page.goto("/aceitar-termos");
  await expect(page).toHaveURL(/\/chat/);
});
