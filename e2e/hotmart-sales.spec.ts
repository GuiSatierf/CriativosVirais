import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

function sale(event: string, transaction: string, src?: string) {
  return {
    id: randomUUID(),
    creation_date: Date.now(),
    event,
    version: "2.0.0",
    data: {
      buyer: { email: "comprador@exemplo.test", name: "Comprador" },
      purchase: {
        transaction,
        status: "APPROVED",
        price: { value: 97.5, currency_value: "BRL" },
        ...(src == null ? {} : { origin: { src } }),
      },
    },
  };
}

test("a client connects Hotmart and each sale arrives with the creative code from the link", async ({ page, request }) => {
  const email = `hotmart-vendas-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const hottok = `hottok-${randomUUID()}`;

  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Conectar Hotmart" }).click();
  await page.locator("#hotmart-hottok").fill(hottok);
  await page.getByRole("button", { name: "Gerar endereço" }).click();
  const address = page.getByRole("textbox", { name: "Endereço para a Hotmart" });
  await expect(address).toHaveValue(/\/api\/ingest\/hotmart\/[A-Za-z0-9_-]{32,}$/);
  const path = new URL(await address.inputValue()).pathname;
  const send = (body: unknown, token = hottok) => request.post(path, { data: body, headers: { "X-HOTMART-HOTTOK": token } });

  // Only this client's hottok is accepted.
  expect((await send(sale("PURCHASE_APPROVED", "HP0001", "L01-C02"), "outro")).status()).toBe(401);

  // An approved sale and its refund land with the creative code; the warranty's COMPLETE adds nothing.
  expect((await (await send(sale("PURCHASE_APPROVED", "HP0001", "L01-C02"))).json()).accepted).toBe(true);
  expect((await send(sale("PURCHASE_APPROVED", "HP0001", "L01-C02"))).status()).toBe(200);
  expect((await (await send(sale("PURCHASE_COMPLETE", "HP0001", "L01-C02"))).json()).accepted).toBe(false);
  expect((await (await send(sale("PURCHASE_REFUNDED", "HP0001", "L01-C02"))).json()).accepted).toBe(true);
  const rows = await testDatabase<{ status: string; creative_key: string; revenue_cents: string; raw: unknown }>(
    `select status, creative_key, revenue_cents::text, raw from sales_events
     where tenant_id = (select tenant_id from tenant_members where user_id = (select id from "user" where email = $1))
     order by status`,
    [email],
  );
  expect(rows.map(({ status, creative_key, revenue_cents }) => [status, creative_key, revenue_cents])).toEqual([
    ["approved", "L01-C02", "9750"],
    ["refunded", "L01-C02", "9750"],
  ]);
  // The buyer's personal data is never stored with the sale.
  expect(JSON.stringify(rows.map((row) => row.raw))).not.toContain("comprador@exemplo.test");
});
