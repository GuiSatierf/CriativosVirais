import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase, testPassword, waitForSignUpSlot } from "./support";

// playwright.config.ts points the app's email outbox here, so no message is really sent.
async function inviteTo(email: string) {
  const outbox = "test-results/outbox";
  const messages = await Promise.all(
    (await readdir(outbox).catch(() => [])).map(async (file) => JSON.parse(await readFile(path.join(outbox, file), "utf8"))),
  );
  return messages.filter((message) => message.to === email && message.subject === "Seu acesso ao Criativos Virais foi liberado");
}

function purchase(event: string, email: string, productId = 1234567) {
  return {
    id: randomUUID(),
    creation_date: Date.now(),
    event,
    version: "2.0.0",
    data: {
      product: { id: productId, ucode: "abc", name: "Criativos Virais" },
      buyer: { email, name: "Compradora Teste" },
      purchase: { transaction: `HP${randomUUID()}`, status: "APPROVED", origin: { sck: "L01-C02" } },
    },
  };
}

/** The refund or chargeback Hotmart sends for an earlier purchase carries that purchase's transaction. */
function reversalOf(event: string, approved: ReturnType<typeof purchase>) {
  return { ...purchase(event, approved.data.buyer.email), data: approved.data };
}

test("a Hotmart purchase frees the email to sign up and a refund blocks the account with the reason", async ({ page, request }) => {
  const email = `hotmart-${randomUUID()}@exemplo.test`;
  const send = (body: unknown, hottok = "e2e-hottok") =>
    request.post("/api/hotmart/access", { data: body, headers: { "X-HOTMART-HOTTOK": hottok } });

  // 1. Only Hotmart's hottok is accepted, and other products on the account grant nothing.
  expect((await send(purchase("PURCHASE_APPROVED", email), "errado")).status()).toBe(401);
  expect((await (await send(purchase("PURCHASE_APPROVED", email, 999))).json()).result).toBe("ignored");

  // 2. An approved purchase frees the buyer's email; a repeated delivery changes nothing.
  const approved = purchase("PURCHASE_APPROVED", email);
  expect((await (await send(approved)).json()).result).toBe("granted");
  expect((await send(approved)).status()).toBe(200);
  const grants = await testDatabase<{ source: string }>(`select source from access_grants where email = $1`, [email]);
  expect(grants).toEqual([{ source: "hotmart" }]);

  // The buyer gets one branded invite whose link opens sign-up with the email already filled in.
  await expect.poll(async () => (await inviteTo(email)).length).toBe(1);
  const [invite] = await inviteTo(email);
  expect(invite.html).toContain("/brand/logo-email.png");
  const link = invite.text.match(/https?:\/\/\S+\/signup\?email=\S+/)?.[0] ?? "";
  expect(link).not.toBe("");

  await waitForSignUpSlot();
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await page.getByLabel("Nome").fill("Compradora Teste");
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

  // 3. A refund of her only purchase signs the buyer out and the login says why.
  expect((await (await send(reversalOf("PURCHASE_REFUNDED", approved))).json()).result).toBe("revoked");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Sua conta está bloqueada: compra reembolsada na Hotmart.", { exact: false })).toBeVisible();

  // 4. A late retry of the refunded purchase changes nothing; a payload that is not a purchase is acknowledged.
  await send(approved);
  const [stillBlocked] = await testDatabase<{ banned: boolean }>(`select banned from "user" where email = $1`, [email]);
  expect(stillBlocked.banned).toBe(true);
  expect((await (await send({ event: "SUBSCRIPTION_CANCELLATION", data: {} })).json()).result).toBe("ignored");
  // Without the transaction a refund could not be matched to its approval, so nothing changes.
  const anonymous = purchase("PURCHASE_APPROVED", email);
  expect((await (await send({ ...anonymous, data: { ...anonymous.data, purchase: { status: "APPROVED" } } })).json()).result).toBe("ignored");

  // 5. A new purchase lifts the block the refund put on the account.
  await send(purchase("PURCHASE_APPROVED", email));
  const [account] = await testDatabase<{ banned: boolean }>(`select banned from "user" where email = $1`, [email]);
  expect(account.banned).toBe(false);

  // 6. A block the team put on the account outlives a refund and a later purchase.
  await testDatabase(`update "user" set banned = true, ban_reason = 'bloqueio da equipe' where email = $1`, [email]);
  await send(purchase("PURCHASE_REFUNDED", email));
  await send(purchase("PURCHASE_APPROVED", email));
  const [teamBlocked] = await testDatabase<{ banned: boolean; ban_reason: string }>(`select banned, ban_reason from "user" where email = $1`, [email]);
  expect(teamBlocked).toEqual({ banned: true, ban_reason: "bloqueio da equipe" });
});

test("a reversal of another purchase made with a buyer's email keeps her access while her own purchase is paid", async ({ page, request }) => {
  const email = `hotmart-${randomUUID()}@exemplo.test`;
  const send = (body: unknown) => request.post("/api/hotmart/access", { data: body, headers: { "X-HOTMART-HOTTOK": "e2e-hottok" } });
  const banned = async () => (await testDatabase<{ banned: boolean }>(`select banned from "user" where email = $1`, [email]))[0]?.banned;

  const own = purchase("PURCHASE_APPROVED", email);
  expect((await (await send(own)).json()).result).toBe("granted");
  await signUp(page, email);

  // Someone else buys with her email and has that order charged back: she stays in.
  const other = purchase("PURCHASE_APPROVED", email);
  await send(other);
  expect((await (await send(reversalOf("PURCHASE_CHARGEBACK", other))).json()).result).toBe("kept");
  expect(await banned()).toBe(false);
  await page.reload();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

  // Refunding her own purchase too leaves nothing paid, so the account is blocked.
  expect((await (await send(reversalOf("PURCHASE_REFUNDED", own))).json()).result).toBe("revoked");
  expect(await banned()).toBe(true);
});

test("a Hotmart reversal never blocks access the team granted by hand", async ({ page, request }) => {
  const email = `manual-${randomUUID()}@exemplo.test`;
  const send = (body: unknown) => request.post("/api/hotmart/access", { data: body, headers: { "X-HOTMART-HOTTOK": "e2e-hottok" } });
  await signUp(page, email);

  const other = purchase("PURCHASE_APPROVED", email);
  await send(other);
  expect((await (await send(reversalOf("PURCHASE_CHARGEBACK", other))).json()).result).toBe("kept");
  const [account] = await testDatabase<{ banned: boolean }>(`select banned from "user" where email = $1`, [email]);
  expect(account.banned).toBe(false);
});
