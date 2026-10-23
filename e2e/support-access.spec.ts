import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("support enters a client's account without the password, changes its email and password from the panel, and the owner manages the team", async ({ page, browser, baseURL }) => {
  // A client with a findable name, and a support member who already turned on two-factor.
  const clientEmail = `cliente-${randomUUID()}@exemplo.test`;
  const clientName = `Cliente ${randomUUID().slice(0, 8)}`;
  const clientContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  await signUp(await clientContext.newPage(), clientEmail);
  await clientContext.close();
  await testDatabase(`update "user" set name = $2 where email = $1`, [clientEmail, clientName]);

  const staffEmail = `suporte-${randomUUID()}@exemplo.test`;
  await signUp(page, staffEmail);
  await testDatabase(`update "user" set role = 'support', two_factor_enabled = true where email = $1`, [staffEmail]);

  // 1. Support sees only Contas, and the API refuses what the role does not allow.
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel do suporte" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Contas" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Acessos" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Equipe" })).toHaveCount(0);
  expect((await page.request.get("/api/admin/access")).status()).toBe(403);
  expect((await page.request.get("/api/admin/team")).status()).toBe(403);

  // 2. Entering the account asks for a reason, then opens the client's chat under a banner.
  await page.getByLabel("Buscar por nome ou e-mail").fill(clientName);
  const row = page.getByRole("row").filter({ hasText: clientEmail });
  await row.getByRole("button", { name: "Entrar como cliente" }).click();
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page.getByText("Escreva o motivo do acesso.")).toBeVisible();
  await page.getByLabel("Motivo do acesso").fill("Ajuda para importar a planilha");
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page).toHaveURL(/\/chat/);
  const banner = page.getByRole("status").filter({ hasText: "acesso de suporte até" });
  await expect(banner).toContainText(clientName);
  const [entered] = await testDatabase<{ details: { reason: string } }>(
    `select details from admin_audit_log where action = 'account.entered' and target_email = $1`,
    [clientEmail],
  );
  expect(entered.details.reason).toBe("Ajuda para importar a planilha");

  // 3. The client's credentials stay with the client, on screen and on the server.
  await page.goto("/perfil");
  await expect(page.getByRole("button", { name: "Trocar senha" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Excluir conta" })).toBeDisabled();
  const changePassword = await page.request.post("/api/auth/change-password", {
    data: { currentPassword: "x", newPassword: "outra-senha-qualquer" },
    headers: { Origin: baseURL! },
  });
  expect(changePassword.status()).toBe(403);
  expect((await page.request.get("/admin")).status()).toBe(404);

  // 4. Leaving puts the support member's own session back in the panel.
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  // Retried until the banner is hydrated; a click before that does nothing.
  await expect(async () => {
    await banner.getByRole("button", { name: "Sair da conta" }).click();
    await expect(page).toHaveURL(/\/admin\?aba=contas$/, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Painel do suporte" })).toBeVisible();
  const left = await testDatabase(`select 1 from admin_audit_log where action = 'account.left' and target_email = $1`, [clientEmail]);
  expect(left).toHaveLength(1);

  // 5. From the panel, support changes the client's email and sets a new password the client signs in with.
  const newEmail = `novo-${randomUUID()}@exemplo.test`;
  const newPassword = "senha-nova-do-suporte";
  const clientRow = () => page.getByRole("row").filter({ hasText: clientName });
  await clientRow().getByRole("button", { name: `Mais ações para ${clientName}` }).click();
  await page.getByRole("menuitem", { name: "Trocar e-mail" }).click();
  await page.getByLabel("E-mail novo").fill(newEmail);
  await page.getByRole("button", { name: "Salvar e-mail" }).click();
  await expect(clientRow()).toContainText(newEmail);
  await clientRow().getByRole("button", { name: `Mais ações para ${clientName}` }).click();
  await page.getByRole("menuitem", { name: "Definir senha nova" }).click();
  await page.getByRole("textbox", { name: "Senha nova", exact: true }).fill(newPassword);
  await page.getByRole("textbox", { name: "Confirme a senha nova" }).fill(newPassword);
  await page.getByRole("button", { name: "Definir senha" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  const audited = await testDatabase<{ action: string; details: Record<string, string> }>(
    `select action, details from admin_audit_log where target_email = $1 and action in ('account.email_changed', 'account.password_set')`,
    [newEmail],
  );
  expect(audited.map((entry) => entry.action).sort()).toEqual(["account.email_changed", "account.password_set"]);
  expect(JSON.stringify(audited)).not.toContain(newPassword);
  const clientAgain = await browser.newContext({ baseURL, locale: "pt-BR" });
  const login = await clientAgain.newPage();
  await login.goto("/login");
  await login.getByLabel("E-mail").fill(newEmail);
  await login.getByRole("textbox", { name: "Senha" }).fill(newPassword);
  await login.getByRole("button", { name: "Entrar" }).click();
  await expect(login).toHaveURL(/\/chat/);
  await clientAgain.close();

  // 6. An owner adds the client to the team and gets the one-time activation code.
  await testDatabase(`update "user" set role = 'owner' where email = $1`, [staffEmail]);
  await page.goto("/admin?aba=equipe");
  await page.getByRole("button", { name: "Adicionar à equipe" }).click();
  await page.getByLabel("E-mail").fill(newEmail);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Código de ativação, vale 24 horas:")).toBeVisible();
  await page.getByRole("button", { name: "Pronto" }).click();
  await expect(page.getByRole("row").filter({ hasText: newEmail })).toContainText("Suporte");
  const [role] = await testDatabase<{ role: string }>(`select role from "user" where email = $1`, [newEmail]);
  expect(role.role).toBe("support");
});
