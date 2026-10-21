import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase, testPassword } from "./support";

test("only granted emails sign up, /admin is hidden from clients, and a blocked account sees why", async ({ page, browser, baseURL }) => {
  // Respect the real authentication limiter when this extends the existing signup suite.
  await expect.poll(async () => {
    const [limit] = await testDatabase<{ ready: boolean }>(
      `SELECT NOT EXISTS (SELECT 1 FROM rate_limit WHERE key LIKE '%/sign-up/email%'
       AND last_request > extract(epoch FROM clock_timestamp()) * 1000 - 11_000) AS ready`,
    );
    return limit.ready;
  }, { timeout: 15_000, intervals: [1000] }).toBe(true);

  // 1. An email without a grant cannot create an account.
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Sem acesso");
  await page.getByLabel("E-mail").fill(`sem-acesso-${randomUUID()}@exemplo.test`);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Este e-mail ainda não tem acesso.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);

  // 2. A granted email signs up; for a client the admin area does not exist.
  const email = `cliente-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  expect((await page.goto("/admin"))?.status()).toBe(404);

  // 3. An admin without two-factor is sent to turn it on and the API refuses every action.
  await testDatabase(`update "user" set role = 'admin' where email = $1`, [email]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/seguranca$/);
  await expect(page.getByRole("heading", { name: "Proteja o acesso de admin" })).toBeVisible();
  const listed = await page.request.get("/api/admin/access");
  expect(listed.status()).toBe(403);
  const granted = await page.request.post("/api/admin/access", { data: { email: "x@exemplo.test" }, headers: { Origin: baseURL! } });
  expect(granted.status()).toBe(403);
  // Enrolling an admin's two-factor needs the operator's one-time code, not just the password.
  const enroll = await page.request.post("/api/auth/two-factor/enable", { data: { password: testPassword, method: "totp" }, headers: { Origin: baseURL! } });
  expect(enroll.status()).toBe(403);
  // The plugin's own admin endpoints are not reachable from the browser either.
  const direct = await page.request.post("/api/auth/admin/ban-user", { data: { userId: "x" }, headers: { Origin: baseURL! } });
  expect(direct.status()).toBe(404);

  // 4. A blocked account cannot start a session and reads the reason after the right password.
  await testDatabase(`update "user" set banned = true, ban_reason = 'assinatura cancelada' where email = $1`, [email]);
  const fresh = await browser.newContext({ baseURL, locale: "pt-BR" });
  const login = await fresh.newPage();
  await login.goto("/login");
  await login.getByLabel("E-mail").fill(email);
  await login.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await login.getByRole("button", { name: "Entrar" }).click();
  await expect(login.getByText("Sua conta está bloqueada: assinatura cancelada.", { exact: false })).toBeVisible();
  await expect(login).toHaveURL(/\/login$/);
  await fresh.close();
});
