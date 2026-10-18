import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signUp } from "./support";

test("deleting the account requires the password on the server", async ({ page, baseURL }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Respect the real authentication limiter when this extends the existing signup suite.
    await expect.poll(async () => {
      const { rows: [limit] } = await pool.query<{ ready: boolean }>(
        `SELECT NOT EXISTS (SELECT 1 FROM rate_limit WHERE key LIKE '%/sign-up/email%'
         AND last_request > extract(epoch FROM clock_timestamp()) * 1000 - 11_000) AS ready`,
      );
      return limit.ready;
    }, { timeout: 15_000, intervals: [1000] }).toBe(true);
    await signUp(page);
    const session = await (await page.request.get("/api/auth/get-session")).json();
    const headers = { Origin: baseURL! };

    // A fresh session used to be enough: the call below deleted everything without a password.
    const withoutPassword = await page.request.post("/api/auth/delete-user", { data: {}, headers });
    expect(withoutPassword.status()).toBe(400);
    const wrongPassword = await page.request.post("/api/auth/delete-user", {
      data: { password: "senha-errada-de-teste" }, headers,
    });
    expect(wrongPassword.status()).toBe(400);
    const { rows: [kept] } = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM tenant_members WHERE user_id = $1",
      [session.user.id],
    );
    expect(kept.count).toBe(1);

    await page.goto("/perfil");
    await page.getByRole("button", { name: "Excluir conta" }).click();
    await page.getByLabel("Digite sua senha para confirmar").fill("e2e-senha-de-teste");
    await page.getByRole("button", { name: "Excluir para sempre" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    const { rows: [gone] } = await pool.query<{ count: number }>(
      `SELECT (SELECT count(*) FROM "user" WHERE id = $1)
            + (SELECT count(*) FROM tenant_members WHERE user_id = $1) AS count`,
      [session.user.id],
    );
    expect(Number(gone.count)).toBe(0);
  } finally {
    await pool.end();
  }
});
