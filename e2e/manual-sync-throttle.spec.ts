import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signUp } from "./support";

test("a throttled manual sync shows an error without starting the polling state", async ({ page, baseURL }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await signUp(page);
    const session = await (await page.request.get("/api/auth/get-session")).json();
    // A credential-free fixture prevents the worker from calling the real provider.
    const { rows: [integration] } = await pool.query<{ id: string }>(
      `INSERT INTO integrations (tenant_id, provider, status, last_sync_at)
       SELECT tenant_id, 'utmify', 'connected', now() FROM tenant_members WHERE user_id = $1
       RETURNING id`,
      [session.user.id],
    );
    await page.goto("/integracoes");
    const sync = page.getByRole("button", { name: "Sincronizar agora" });
    await expect(sync).toBeEnabled();

    // Leave enough time in the fixed slot for the worker and the browser assertions.
    await expect.poll(async () => {
      const { rows: [clock] } = await pool.query<{ elapsed: number }>(
        "SELECT mod(extract(epoch FROM clock_timestamp()), 300)::float8 AS elapsed",
      );
      return clock.elapsed < 240;
    }, { timeout: 65_000, intervals: [1000] }).toBe(true);

    const accepted = await page.request.post("/api/integrations/sync", {
      data: {}, headers: { Origin: baseURL! },
    });
    expect(accepted.status()).toBe(202);
    expect(await accepted.json()).toEqual({ queued: true });
    await expect.poll(async () => {
      const { rows: [job] } = await pool.query<{ state: string }>(
        "SELECT state FROM pgboss.job WHERE name = 'sync-metrics' AND singleton_key = $1",
        [integration.id],
      );
      return job?.state;
    }, { timeout: 30_000 }).toBe("completed");

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/integrations/sync") && response.request().method() === "POST",
    );
    await sync.click();
    const blocked = await responsePromise;
    expect(blocked.status()).toBe(429);
    expect(await blocked.json()).toEqual({
      error: "Você pediu uma sincronização há pouco. Aguarde até 5 minutos para pedir de novo.",
    });
    await expect(page.getByText("Você pediu uma sincronização há pouco. Aguarde até 5 minutos para pedir de novo.", { exact: true })).toBeVisible();
    await expect(sync).toBeEnabled();
    await expect(page.getByRole("button", { name: "Sincronizando…" })).toHaveCount(0);
    await expect(page.getByText("Sincronização iniciada.", { exact: true })).toHaveCount(0);
    const { rows: [count] } = await pool.query<{ total: number }>(
      "SELECT count(*)::integer AS total FROM pgboss.job WHERE name = 'sync-metrics' AND singleton_key = $1",
      [integration.id],
    );
    expect(count.total).toBe(1);
  } finally {
    await pool.end();
  }
});
