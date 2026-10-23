import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { testDatabase, testPassword, waitForSignUpSlot } from "./support";

function purchase(event: string, email: string, productId = 1234567) {
  return {
    id: randomUUID(),
    creation_date: Date.now(),
    event,
    version: "2.0.0",
    data: {
      product: { id: productId, ucode: "abc", name: "Criativos Virais" },
      buyer: { email, name: "Compradora Teste" },
      purchase: { transaction: `HP${Date.now()}`, status: "APPROVED", origin: { sck: "L01-C02" } },
    },
  };
}

test("a Hotmart purchase frees the email to sign up and a refund blocks the account with the reason", async ({ page, request }) => {
  const email = `hotmart-${randomUUID()}@exemplo.test`;
  const send = (body: unknown, hottok = "e2e-hottok") =>
    request.post("/api/hotmart/access", { data: body, headers: { "X-HOTMART-HOTTOK": hottok } });

  // 1. Only Hotmart's hottok is accepted, and other products on the account grant nothing.
  expect((await send(purchase("PURCHASE_APPROVED", email), "errado")).status()).toBe(401);
  expect((await (await send(purchase("PURCHASE_APPROVED", email, 999))).json()).result).toBe("ignored");

  // 2. An approved purchase frees the buyer's email; a repeated delivery changes nothing.
  expect((await (await send(purchase("PURCHASE_APPROVED", email))).json()).result).toBe("granted");
  expect((await send(purchase("PURCHASE_APPROVED", email))).status()).toBe(200);
  const grants = await testDatabase<{ source: string }>(`select source from access_grants where email = $1`, [email]);
  expect(grants).toEqual([{ source: "hotmart" }]);

  await waitForSignUpSlot();
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Compradora Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

  // 3. A refund signs the buyer out and the login says why.
  expect((await (await send(purchase("PURCHASE_REFUNDED", email))).json()).result).toBe("revoked");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Sua conta está bloqueada: compra reembolsada na Hotmart.", { exact: false })).toBeVisible();

  // 4. Buying again lifts the block the refund put on the account.
  await send(purchase("PURCHASE_APPROVED", email));
  const [account] = await testDatabase<{ banned: boolean }>(`select banned from "user" where email = $1`, [email]);
  expect(account.banned).toBe(false);
});
