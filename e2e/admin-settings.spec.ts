import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

const panelHottok = `painel-${randomUUID()}`;
const panelProduct = 7654321;

function hotmartEvent(event: string, data: Record<string, unknown>) {
  return { id: randomUUID(), creation_date: Date.now(), event, version: "2.0.0", data };
}

function purchase(email: string) {
  return hotmartEvent("PURCHASE_APPROVED", {
    product: { id: panelProduct },
    buyer: { email },
    purchase: { transaction: `HP${randomUUID()}` },
  });
}

function cancellation(email: string, lastPaidDay: number) {
  return hotmartEvent("SUBSCRIPTION_CANCELLATION", {
    product: { id: panelProduct },
    subscriber: { code: "QO4THU04", email },
    subscription: { id: 471681 },
    date_next_charge: lastPaidDay,
    cancellation_date: Date.now(),
  });
}

async function accountBlock(email: string) {
  const [account] = await testDatabase<{ banned: boolean | null; ban_reason: string | null }>(
    `select banned, ban_reason from "user" where email = $1`,
    [email],
  );
  return account;
}

// The settings row is shared by every spec; the next ones fall back to the hottok in playwright.config.ts.
test.afterEach(async () => {
  await testDatabase(`delete from app_settings`);
});

test("the owner sets Hotmart, the AI limit and the end of access in the panel, and only the owner can", async ({ page, browser, baseURL, request }) => {
  await testDatabase(`delete from app_settings`);
  const ownerEmail = `dono-${randomUUID()}@exemplo.test`;
  await signUp(page, ownerEmail);
  await testDatabase(`update "user" set role = 'owner', two_factor_enabled = true where email = $1`, [ownerEmail]);
  const send = (body: unknown, hottok = panelHottok) =>
    request.post("/api/hotmart/access", { data: body, headers: { "X-HOTMART-HOTTOK": hottok } });

  // 1. Hotmart: the hottok typed in the panel replaces the server's, and is never shown again.
  await page.goto("/admin?aba=configuracoes");
  const hotmart = page.getByRole("region", { name: "Hotmart" });
  await expect(page.getByRole("tab", { name: "Configurações" })).toHaveAttribute("aria-selected", "true");
  await expect(hotmart.getByLabel("Endereço para cadastrar na Hotmart")).toHaveValue(`${baseURL}/api/hotmart/access`);
  await hotmart.getByLabel("Números dos produtos").fill(String(panelProduct));
  await hotmart.getByRole("button", { name: "Salvar Hotmart" }).click();
  await expect(hotmart.getByText("Cole o hottok da Hotmart.")).toBeVisible();
  await hotmart.getByLabel("Hottok").fill(panelHottok);
  await hotmart.getByRole("button", { name: "Salvar Hotmart" }).click();
  await expect(hotmart.getByText("Configurada", { exact: true })).toBeVisible();
  await expect(hotmart.getByLabel("Hottok")).toHaveValue("");
  expect(await page.content()).not.toContain(panelHottok);
  const [stored] = await testDatabase<{ hotmart_hottok: string }>(`select hotmart_hottok from app_settings`);
  expect(stored.hotmart_hottok).not.toContain(panelHottok);

  const buyer = `assinante-${randomUUID()}@exemplo.test`;
  expect((await send(purchase(buyer), "e2e-hottok")).status()).toBe(401);
  const buyerPurchase = purchase(buyer);
  expect((await (await send(buyerPurchase)).json()).result).toBe("granted");

  // 2. The AI limit per client is saved in cents.
  const aiLimit = page.getByRole("region", { name: "Limite de IA por cliente" });
  await aiLimit.getByLabel("Gasto máximo por mês").fill("0,50");
  await aiLimit.getByRole("button", { name: "Salvar limite" }).click();
  await expect(aiLimit.getByText("Informe um valor a partir de R$ 1,00, como 20,00.")).toBeVisible();
  await aiLimit.getByLabel("Gasto máximo por mês").fill("15.000,00");
  await aiLimit.getByRole("button", { name: "Salvar limite" }).click();
  await expect(aiLimit.getByText("O limite máximo é R$ 10.000,00 por mês.")).toBeVisible();
  const savedLimit = async () => (await testDatabase<{ cents: string }>(`select ai_monthly_limit_cents::text as cents from app_settings`))[0]?.cents;
  await aiLimit.getByLabel("Gasto máximo por mês").fill("35,50");
  await aiLimit.getByRole("button", { name: "Salvar limite" }).click();
  await expect.poll(savedLimit).toBe("3550");
  // A dot typed as the decimal mark, as phone keypads do, is not read as thousands.
  await aiLimit.getByLabel("Gasto máximo por mês").fill("20.50");
  await aiLimit.getByRole("button", { name: "Salvar limite" }).click();
  await expect.poll(savedLimit).toBe("2050");

  // 3. Keeping access until the paid period ends: the cancellation waits for the last paid day.
  const accessEnd = page.getByRole("region", { name: "Quando o acesso termina" });
  await accessEnd.getByRole("radio", { name: /Manter até o fim do período pago/ }).check();
  await accessEnd.getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => (await testDatabase<{ policy: string }>(`select access_end_policy as policy from app_settings`))[0]?.policy).toBe("end_of_period");
  const subscriberContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  await signUp(await subscriberContext.newPage(), buyer);
  await subscriberContext.close();
  expect((await (await send(cancellation(buyer, Date.now() + 4_000))).json()).result).toBe("scheduled");
  expect((await accountBlock(buyer)).banned).not.toBe(true);
  await expect.poll(async () => (await accountBlock(buyer)).ban_reason, { timeout: 60_000 }).toBe("assinatura cancelada na Hotmart");

  // 4. Blocking at once, the default: a cancellation takes access away immediately.
  await accessEnd.getByRole("radio", { name: /Bloquear na hora/ }).check();
  await accessEnd.getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => (await testDatabase<{ policy: string }>(`select access_end_policy as policy from app_settings`))[0]?.policy).toBe("immediate");
  const secondBuyer = `assinante-${randomUUID()}@exemplo.test`;
  expect((await (await send(purchase(secondBuyer))).json()).result).toBe("granted");
  const secondContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  await signUp(await secondContext.newPage(), secondBuyer);
  await secondContext.close();
  expect((await (await send(cancellation(secondBuyer, Date.now() + 86_400_000))).json()).result).toBe("revoked");
  expect((await accountBlock(secondBuyer)).ban_reason).toBe("assinatura cancelada na Hotmart");

  // Every change is audited without the hottok.
  const audited = await testDatabase<{ action: string; details: Record<string, string> }>(
    `select action, details from admin_audit_log where actor_email = $1 and action like 'settings.%'`,
    [ownerEmail],
  );
  expect(audited.map((entry) => entry.action).sort()).toEqual([
    "settings.access_end_changed",
    "settings.access_end_changed",
    "settings.ai_limit_changed",
    "settings.ai_limit_changed",
    "settings.hotmart_changed",
  ]);
  expect(JSON.stringify(audited)).not.toContain(panelHottok);

  // 5. An admin neither sees the tab nor saves through the API.
  await testDatabase(`update "user" set role = 'admin' where email = $1`, [ownerEmail]);
  await page.goto("/admin?aba=configuracoes");
  await expect(page.getByRole("tab", { name: "Acessos" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Configurações" })).toHaveCount(0);
  const refused = await page.request.put("/api/admin/settings", {
    data: { section: "ai-limit", cents: 999_999 },
    headers: { Origin: baseURL ?? "" },
  });
  expect(refused.status()).toBe(403);
});
