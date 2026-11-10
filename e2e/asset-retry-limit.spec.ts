import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("a failed file can be sent for analysis again three times a day, not forever", async ({ page, baseURL }) => {
  const email = `e2e-${randomUUID()}@exemplo.test`;
  await signUp(page, email);
  const [{ tenant_id: tenantId }] = await testDatabase<{ tenant_id: string }>(
    `select m.tenant_id from tenant_members m join "user" u on u.id = m.user_id where u.email = $1`,
    [email],
  );
  const assetId = randomUUID();
  await testDatabase(
    `insert into assets (id, tenant_id, kind, s3_key, mime, size, status, upload_completed_at)
     values ($1, $2, 'video', $3, 'video/mp4', 1000, 'error', now())`,
    [assetId, tenantId, `${tenantId}/${randomUUID()}`],
  );
  const retry = async () => {
    // The worker may pick a retry up and change the status; each attempt starts from a failed file.
    await testDatabase(`update assets set status = 'error' where id = $1`, [assetId]);
    return (await page.request.post(`/api/assets/${assetId}/retry`, { headers: { Origin: baseURL! } })).status();
  };

  for (let attempt = 1; attempt <= 3; attempt++) expect(await retry()).toBe(202);
  // Each retry pays for transcription and analysis again, so the fourth one today is refused.
  expect(await retry()).toBe(429);
});
