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
    // The full deletion also clears storage, which this suite does not configure; it is checked by hand.
  } finally {
    await pool.end();
  }
});
