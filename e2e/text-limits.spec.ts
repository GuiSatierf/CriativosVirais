import { expect, test } from "@playwright/test";
import { signUp } from "./support";

// A pasted name longer than the field allowed was cut at the limit without a word.
test("the profile name says when it reached its character limit", async ({ page }) => {
  await signUp(page);
  await page.goto("/perfil");

  await page.getByLabel("Nome", { exact: true }).fill("a".repeat(150));

  await expect(page.getByText("Limite de 100 caracteres atingido.")).toBeVisible();
});

// Better Auth read any body whole and stored any name length; the screens were the only limit.
test("the auth endpoints refuse an oversized body and a name past 100 characters", async ({ page, request }) => {
  const huge = await request.post("/api/auth/sign-in/email", {
    data: { email: "ninguem@exemplo.test", password: "x".repeat(200_000) },
  });
  expect(huge.status()).toBe(413);

  await signUp(page);
  const renamed = await page.request.post("/api/auth/update-user", {
    data: { name: "a".repeat(101) },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(renamed.status()).toBe(400);
});

