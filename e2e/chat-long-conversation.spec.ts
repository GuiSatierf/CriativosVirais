import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { sendMessage, signUp, testDatabase } from "./support";

test("a conversation with more than a hundred messages still answers, and each send carries only the new message", async ({ page }) => {
  const email = `longa-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const conversationId = page.url().split("/").at(-1);

  // 120 earlier messages, as if the client had chatted for weeks.
  await testDatabase(
    `insert into messages (tenant_id, conversation_id, role, content, created_at)
     select c.tenant_id, c.id, r.role,
            jsonb_build_object('id', gen_random_uuid()::text, 'role', r.role,
                               'parts', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Mensagem antiga ' || n))),
            now() - interval '1 day' + n * interval '1 minute'
     from conversations c, generate_series(1, 120) n,
          lateral (select case when n % 2 = 1 then 'user' else 'assistant' end as role) r
     where c.id = $1`,
    [conversationId],
  );
  await page.reload();
  await expect(page.getByText("Mensagem antiga 120")).toBeVisible();

  const request = page.waitForRequest((sent) => sent.url().endsWith("/api/chat") && sent.method() === "POST");
  await sendMessage(page, "Ainda funciona?");
  expect((await request).postDataJSON().messages).toHaveLength(1);
  await expect(page.getByText("Não foi possível gerar a resposta.")).toHaveCount(0);
  const [{ replies }] = await testDatabase<{ replies: number }>(
    `select count(*)::int as replies from messages where conversation_id = $1 and role = 'assistant' and created_at > now() - interval '5 minutes'`,
    [conversationId],
  );
  expect(replies).toBe(1);
});
