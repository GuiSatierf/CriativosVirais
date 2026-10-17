import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

const testPassword = "e2e-senha-de-teste";

/** Creates a fresh account (and operation) and waits for its first conversation. */
export async function signUp(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Nome").fill("Conta E2E");
  await page.getByLabel("E-mail").fill(`e2e-${randomUUID()}@exemplo.test`);
  await page.getByRole("textbox", { name: "Senha" }).fill(testPassword);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
}

/** Sends one chat message and waits until the assistant finished answering. */
export async function sendMessage(page: Page, text: string) {
  const field = page.getByPlaceholder("Escreva para o Estrategista…");
  await field.fill(text);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByRole("button", { name: "Parar resposta" })).toBeHidden();
}

/** Uses the fake model's script to save the demo offer and generate a two-script batch. */
export async function createBatchThroughChat(page: Page) {
  await sendMessage(page, "Eu vendo um curso de rotina para mães que trabalham fora.");
  await expect(page.getByRole("link", { name: /Anotei na sua oferta/ })).toBeVisible();
  await sendMessage(page, "Gere uma leva com dois roteiros.");
  const batchLink = page.getByRole("link", { name: /Abrir leva de roteiros/ });
  await expect(batchLink).toBeVisible();
  const href = await batchLink.getAttribute("href");
  const batchId = href?.match(/\/levas\/([0-9a-f-]{36})/)?.[1];
  expect(batchId, "batch link").toBeTruthy();
  return { batchLink, batchId: batchId! };
}

/** Calendar day (YYYY-MM-DD) in São Paulo, the app's reporting timezone. */
export function saoPauloDay(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
