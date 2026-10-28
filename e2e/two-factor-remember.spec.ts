import { expect, test } from "@playwright/test";

// Better Auth owns the trusted-device cookie; this checks the screen asks for it only when the box is ticked.
test("the two-factor step remembers this computer only when the person ticks the box", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/auth/sign-in/email", (route) => route.fulfill({ json: { twoFactorRedirect: true } }));
  await page.route("**/api/auth/two-factor/verify-totp", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 401, json: { code: "INVALID_CODE", message: "Invalid code" } });
  });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("equipe@exemplo.test");
  await page.getByRole("textbox", { name: "Senha" }).fill("qualquer-senha-de-teste");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Confirme que é você" })).toBeVisible();

  const remember = page.getByRole("checkbox", { name: /Lembrar este computador por 30 dias/ });
  await expect(remember).not.toBeChecked();
  const confirm = page.getByRole("button", { name: "Confirmar e entrar" });
  await page.getByLabel("Código do app").fill("123456");
  await confirm.click();
  await expect.poll(() => sent.length).toBe(1);

  await remember.check();
  await confirm.click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent).toEqual([
    { code: "123456", trustDevice: false },
    { code: "123456", trustDevice: true },
  ]);
});
