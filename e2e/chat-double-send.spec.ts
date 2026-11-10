import { expect, test } from "@playwright/test";
import { sendMessage, signUp, testDatabase } from "./support";

test("a double click on Enviar sends once and the reply still arrives", async ({ page }) => {
  await signUp(page);
  const conversationId = page.url().split("/").at(-1);
  // The composer moves when the first message goes out; from then on Parar sits where Enviar was.
  await sendMessage(page, "Primeira mensagem.");

  await page.getByPlaceholder("Escreva para o Estrategista…").fill("Mensagem enviada com clique duplo.");
  await page.getByRole("button", { name: "Enviar mensagem" }).dblclick();

  await expect(page.getByText("Recebi a sua mensagem.", { exact: false })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Parar resposta" })).toBeHidden();
  const replies = await testDatabase<{ parts: number }>(
    `select jsonb_array_length(coalesce(content->'parts', '[]'::jsonb)) as parts
       from messages where conversation_id = $1 and role = 'assistant'`,
    [conversationId],
  );
  expect(replies).toHaveLength(2);
  expect(replies.every((reply) => reply.parts > 0)).toBe(true);
});
