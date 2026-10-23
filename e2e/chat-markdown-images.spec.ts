import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signUp } from "./support";

test("a markdown image in a reply shows only its alt text", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const reply = {
    id: randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: "Veja o anúncio:\n\n![Anúncio do concorrente](https://imagens.exemplo.test/pixel.png?c=1)" }],
  };
  try {
    await signUp(page);
    const conversationId = page.url().split("/").at(-1)!;
    const session = await (await page.request.get("/api/auth/get-session")).json();
    await pool.query(
      `INSERT INTO messages (tenant_id, conversation_id, role, content, created_at)
       SELECT c.tenant_id, c.id, 'assistant', $3::jsonb, now()
       FROM conversations c JOIN tenant_members m ON m.tenant_id = c.tenant_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [conversationId, session.user.id, JSON.stringify(reply)],
    );
    await page.reload();

    const list = page.getByRole("region", { name: "Mensagens da conversa" });
    await expect(list.getByText("Anúncio do concorrente")).toBeVisible();
    await expect(list.locator('img[src*="imagens.exemplo.test"]')).toHaveCount(0);
  } finally {
    await pool.end();
  }
});
