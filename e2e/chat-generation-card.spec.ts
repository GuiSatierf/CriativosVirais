import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signUp } from "./support";

test("a finished batch is not shown as generating while its status loads", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const generationId = randomUUID();
  const reply = {
    id: randomUUID(),
    role: "assistant",
    parts: [{ type: "data-generation", data: { id: generationId, title: "Leva 01 · Teste" } }],
  };
  const { promise: statusHeld, resolve: releaseStatus } = Promise.withResolvers<void>();
  try {
    await signUp(page);
    const conversationId = page.url().split("/").at(-1);
    const session = await (await page.request.get("/api/auth/get-session")).json();
    await pool.query(
      `INSERT INTO messages (tenant_id, conversation_id, role, content, created_at)
       SELECT c.tenant_id, c.id, 'assistant', $3::jsonb, now()
       FROM conversations c JOIN tenant_members m ON m.tenant_id = c.tenant_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [conversationId, session.user.id, JSON.stringify(reply)],
    );
    await page.route(`**/api/batch-generations/${generationId}`, async (route) => {
      await statusHeld;
      await route.fulfill({
        json: { status: "done", title: "Leva 01 · Teste", batchId: randomUUID(), error: null },
      });
    });

    await page.reload();

    const list = page.getByRole("region", { name: "Mensagens da conversa" });
    await expect(list.getByText("Leva 01 · Teste")).toBeVisible();
    // The card used to say "Gerando" until the first status answer, even for a finished batch.
    await expect(list.getByText(/Gerando/)).toHaveCount(0);
    releaseStatus();
    await expect(list.getByRole("link", { name: /Abrir leva de roteiros/ })).toBeVisible();
  } finally {
    releaseStatus();
    await pool.end();
  }
});
