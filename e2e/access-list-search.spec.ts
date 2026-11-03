import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUp, testDatabase } from "./support";

test("the Acessos tab shows the most recent grants, finds older ones on the server and keeps long emails inside the table", async ({ page }) => {
  const ownerEmail = `dono-${randomUUID()}@exemplo.test`;
  await signUp(page, ownerEmail);
  await testDatabase(`update "user" set role = 'owner', two_factor_enabled = true where email = $1`, [ownerEmail]);

  // More grants than one page, the oldest far in the past, plus one very long email from today.
  const batch = randomUUID().slice(0, 8);
  await testDatabase(
    `insert into access_grants (email, created_at)
     select 'lote-' || $1 || '-' || lpad(n::text, 3, '0') || '@exemplo.test', timestamp '2000-01-01' + n * interval '1 minute'
     from generate_series(0, 100) as n`,
    [batch],
  );
  const longEmail = `${"comprador-com-nome-muito-comprido-".repeat(3)}${batch}@exemplo.test`;
  await testDatabase(`insert into access_grants (email) values ($1)`, [longEmail]);

  await page.goto("/admin?aba=acessos");
  await expect(page.getByText(/Mostrando os 100 mais recentes de/)).toBeVisible();
  const oldest = `lote-${batch}-000@exemplo.test`;
  await expect(page.getByRole("cell", { name: oldest })).toHaveCount(0);

  await page.getByLabel("Buscar por e-mail").fill(oldest);
  await expect(page.getByRole("cell", { name: oldest })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);

  await page.getByLabel("Buscar por e-mail").fill(batch);
  await expect(page.getByRole("cell", { name: longEmail })).toBeVisible();
  const table = page.locator('[data-slot="table-container"]');
  expect(await table.evaluate((container) => container.scrollWidth <= container.clientWidth)).toBe(true);
});
