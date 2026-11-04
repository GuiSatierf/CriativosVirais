import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

const nowInMs = "(extract(epoch FROM clock_timestamp()) * 1000)::bigint";

/** Starts the account's window on a route as if it had already sent `count` requests. */
async function fillWindow(userId: string, route: string, count: number, ageInMs = 0) {
  await testDatabase(
    `INSERT INTO rate_limit (id, key, count, last_request)
     SELECT gen_random_uuid()::text, 'app:' || $2 || ':' || tenant_id, $3, ${nowInMs} - $4
     FROM tenant_members WHERE user_id = $1
     ON CONFLICT (key) DO UPDATE SET count = excluded.count, last_request = excluded.last_request`,
    [userId, route, count, ageInMs],
  );
}

test("chat, upload and import refuse an account past its per-minute and daily limits with a clear message", async ({ page, baseURL }) => {
  if (baseURL == null) throw new Error("Playwright baseURL is not configured");
  await signUp(page);
  const session = await (await page.request.get("/api/auth/get-session")).json();
  const userId: string = session.user.id;
  const headers = { Origin: baseURL };

  await fillWindow(userId, "chat", 20);
  const field = page.getByPlaceholder("Escreva para o Estrategista…");
  await field.fill("Mais uma pergunta.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByText("Não foi possível gerar a resposta.")).toBeVisible();
  await expect(page.getByText("Você enviou muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.")).toBeVisible();
  await expect(page.getByText("Limite de IA do mês atingido.")).toBeHidden();

  // 100 files already sent today: the daily limit refuses the next one until São Paulo midnight.
  await testDatabase(
    `INSERT INTO assets (tenant_id, kind, s3_key, mime, size)
     SELECT tenant_id, 'video', tenant_id || '/e2e-daily-' || n, 'video/mp4', 1000
     FROM tenant_members, generate_series(1, 100) AS n WHERE user_id = $1`,
    [userId],
  );
  const daily = await page.request.post("/api/uploads/presign", {
    data: { kind: "video", mime: "video/mp4", size: 1000 },
    headers,
  });
  expect(daily.status()).toBe(429);
  expect(Number(daily.headers()["retry-after"])).toBeGreaterThan(0);
  expect(Number(daily.headers()["retry-after"])).toBeLessThanOrEqual(86_400);
  expect(await daily.json()).toEqual({ error: "Você chegou ao limite de 100 envios de hoje. Ele renova amanhã." });

  await fillWindow(userId, "upload", 30);
  const upload = await page.request.post("/api/uploads/presign", {
    data: { kind: "video", mime: "video/mp4", size: 1000 },
    headers,
  });
  expect(upload.status()).toBe(429);
  expect(Number(upload.headers()["retry-after"])).toBeGreaterThan(0);
  expect(Number(upload.headers()["retry-after"])).toBeLessThanOrEqual(60);
  expect(await upload.json()).toEqual({
    error: "Você enviou muitos arquivos em pouco tempo. Aguarde um minuto e tente de novo.",
  });

  await fillWindow(userId, "import", 10);
  const blockedImport = await page.request.post("/api/metrics/import", { data: {}, headers });
  expect(blockedImport.status()).toBe(429);
  expect(await blockedImport.json()).toEqual({
    error: "Você importou muitas planilhas em pouco tempo. Aguarde um minuto e tente de novo.",
  });

  // A window older than a minute starts over: the request reaches validation again.
  await fillWindow(userId, "import", 10, 61_000);
  const freshImport = await page.request.post("/api/metrics/import", { data: {}, headers });
  expect(freshImport.status()).toBe(400);
  const [window] = await testDatabase<{ count: number }>(
    `SELECT count FROM rate_limit WHERE key = 'app:import:' || (SELECT tenant_id FROM tenant_members WHERE user_id = $1)`,
    [userId],
  );
  expect(window?.count).toBe(1);
});
