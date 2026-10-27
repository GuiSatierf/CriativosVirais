import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createBatchThroughChat, sendMessage, signUp } from "./support";

const sidebar = (page: Page) => page.getByRole("complementary", { name: "Barra lateral" });

async function conversationId(page: Page) {
  const id = /\/chat\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  expect(id, "conversation id in the address").toBeTruthy();
  return id ?? "";
}

test("projects group conversations in the left bar: create, move, drag, rename and delete", async ({ page, browser, baseURL }) => {
  await signUp(page);
  await sendMessage(page, "Quero ideias de gancho para o meu curso.");
  const first = await conversationId(page);
  const bar = sidebar(page);
  const firstRow = bar.locator(`a[href="/chat/${first}"]`);
  const loose = bar.getByRole("region", { name: "Conversas" });
  await expect(loose.locator(`a[href="/chat/${first}"]`)).toBeVisible();

  // 1. A project is created from the "+" beside Projetos.
  await bar.getByRole("button", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Inglês em 90 Dias");
  await page.getByRole("button", { name: "Salvar" }).click();
  const project = bar.getByRole("button", { name: "Inglês em 90 Dias", exact: true });
  await expect(project).toBeVisible();

  // 2. The conversation menu moves it into the project.
  await firstRow.hover();
  await bar.getByRole("button", { name: /^Ações da conversa / }).first().click();
  await page.getByRole("menuitem", { name: "Mover para projeto" }).click();
  await page.getByRole("menuitem", { name: "Inglês em 90 Dias" }).click();
  await expect(page.getByText("Conversa movida para Inglês em 90 Dias.")).toBeVisible();
  await expect(loose.locator(`a[href="/chat/${first}"]`)).toHaveCount(0);
  await expect(firstRow).toBeVisible();

  // 3. A new conversation opened from the project starts inside it, and another one is dragged in.
  await bar.getByRole("button", { name: "Ações do projeto Inglês em 90 Dias" }).click();
  await page.getByRole("menuitem", { name: "Nova conversa no projeto" }).click();
  await expect(page).not.toHaveURL(new RegExp(first));
  await sendMessage(page, "Agora quero roteiros para o perpétuo.");
  const second = await conversationId(page);
  await expect(loose.locator(`a[href="/chat/${second}"]`)).toHaveCount(0);
  await expect(bar.locator(`a[href="/chat/${second}"]`)).toBeVisible();

  await bar.getByRole("button", { name: "Nova conversa" }).click();
  await expect(page).not.toHaveURL(new RegExp(second));
  await sendMessage(page, "Uma conversa solta.");
  const third = await conversationId(page);
  await loose.locator(`a[href="/chat/${third}"]`).dragTo(project);
  await expect(loose.locator(`a[href="/chat/${third}"]`)).toHaveCount(0);

  // 4. Renaming keeps the conversations; deleting the project sends them back to Conversas.
  await bar.getByRole("button", { name: "Ações do projeto Inglês em 90 Dias" }).click();
  await page.getByRole("menuitem", { name: "Renomear" }).click();
  await page.getByLabel("Nome do projeto").fill("Inglês");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(bar.getByRole("button", { name: "Inglês", exact: true })).toBeVisible();
  await bar.getByRole("button", { name: "Ações do projeto Inglês" }).click();
  await page.getByRole("menuitem", { name: "Apagar projeto" }).click();
  await page.getByRole("button", { name: "Apagar projeto" }).click();
  await expect(bar.getByRole("button", { name: "Inglês", exact: true })).toHaveCount(0);
  for (const id of [first, second, third]) await expect(loose.locator(`a[href="/chat/${id}"]`)).toBeVisible();

  // 5. Another account's project can neither receive nor take this account's conversations.
  const otherContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  const other = await otherContext.newPage();
  await signUp(other, `outra-${randomUUID()}@exemplo.test`);
  const created = await other.request.post("/api/projects", { data: { name: "Alheio" }, headers: { Origin: baseURL ?? "" } });
  const { id: foreignProject } = (await created.json()) as { id: string };
  await otherContext.close();
  const refused = await page.request.patch(`/api/conversations/${first}`, {
    data: { projectId: foreignProject },
    headers: { Origin: baseURL ?? "" },
  });
  expect(refused.status()).toBe(404);
  expect((await page.request.delete(`/api/projects/${foreignProject}`, { headers: { Origin: baseURL ?? "" } })).status()).toBe(404);
});

test("the left bar holds every area, keeps the leva with results in view and opens from ☰ on phones", async ({ page }) => {
  await signUp(page);
  await createBatchThroughChat(page);
  const bar = sidebar(page);
  for (const area of ["Levas", "Resultados", "Minha oferta", "Integrações"])
    await expect(bar.getByRole("link", { name: area, exact: true })).toBeVisible();

  // The account menu keeps only what belongs to the account.
  await bar.getByRole("button", { name: /^Conta de / }).click();
  await expect(page.getByRole("menuitem", { name: "Perfil" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Levas" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // A sale for the leva's first creative gives it results; the notice then stays in the bar in any conversation.
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Importar planilha" }).click();
  const csv = ["utm_content,gasto,vendas,receita", "L01-C01,100,2,394"].join("\n");
  await page.locator("#csv-file").setInputFiles({ name: "metricas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText(/criativos? importados?\./)).toBeVisible();
  await page.goto("/chat");
  await sendMessage(page, "Outra conversa qualquer.");
  await expect(bar.getByRole("link", { name: /Leva 01 já tem resultados/ })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(bar).toBeHidden();
  await expect(page.getByRole("link", { name: /Leva 01 já tem resultados/ })).toBeVisible();
  await page.getByRole("button", { name: "Abrir a barra lateral" }).click();
  const drawer = page.getByRole("dialog", { name: "Barra lateral" });
  await drawer.getByRole("link", { name: "Resultados", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("dialog")).toBeVisible();
});
