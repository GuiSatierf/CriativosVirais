import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { sendMessage, signUp } from "./support";

test("a reply records its AI cost, and a spent monthly budget stops the next one with a clear message", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await signUp(page);
    const session = await (await page.request.get("/api/auth/get-session")).json();
    const tenantOf = `SELECT tenant_id FROM tenant_members WHERE user_id = $1`;

    await sendMessage(page, "Oi, quero começar.");
    const { rows: [recorded] } = await pool.query<{ calls: number }>(
      `SELECT count(*)::int AS calls FROM ai_usage WHERE tenant_id = (${tenantOf}) AND purpose = 'chat'`,
      [session.user.id],
    );
    expect(recorded.calls).toBeGreaterThan(0);

    // Far above the default R$ 20 budget, spent earlier this month.
    await pool.query(
      `INSERT INTO ai_usage (tenant_id, purpose, input_tokens, cached_input_tokens, output_tokens, cost_millicents)
       SELECT tenant_id, 'chat', 0, 0, 0, 1000000000 FROM tenant_members WHERE user_id = $1`,
      [session.user.id],
    );
    const field = page.getByPlaceholder("Escreva para o Estrategista…");
    await field.fill("Mais uma pergunta.");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(page.getByText("Limite de IA do mês atingido.")).toBeVisible();
    await expect(page.getByText(/Você usou todo o limite de IA deste mês\. Ele renova em 1º de/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeHidden();
  } finally {
    await pool.end();
  }
});
