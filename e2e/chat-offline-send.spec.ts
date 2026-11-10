import { expect, test } from "@playwright/test";
import { signUp } from "./support";

test("sending without a connection keeps the chat and lets the message be sent again", async ({ page, context }) => {
  await signUp(page);
  const chatUrl = page.url();
  const text = "Mensagem escrita sem internet.";

  await context.setOffline(true);
  await page.getByPlaceholder("Escreva para o Estrategista…").fill(text);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Não foi possível gerar a resposta.")).toBeVisible();
  await context.setOffline(false);

  expect(page.url()).toBe(chatUrl);
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText("Confira a sua conexão com a internet")).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Recebi a sua mensagem.", { exact: false })).toBeVisible();
});
