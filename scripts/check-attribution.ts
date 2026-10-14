import "dotenv/config";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  // Never default to the application's database. This check bootstraps an empty test DB.
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to an empty dedicated test database.");
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /_test$/, "The dedicated database name must end in _test.");
  process.env.DATABASE_URL = url.toString();
  const { db, pool } = await import("../src/db");
  const { tenants, creatives, creativeMetrics, conversations, batches, batchItems } = await import("../src/db/schema");
  const { saveMetrics } = await import("../src/lib/connectors/persist");
  const { parseCsv } = await import("../src/lib/connectors/csv");
  const { ingestEvent } = await import("../src/jobs/ingest-event");
  const { getCreatives } = await import("../src/lib/creatives");
  const { getBenchmark } = await import("../src/lib/benchmark");
  const { getBatchResults } = await import("../src/lib/results");
  const migrationDir = await mkdtemp(join(tmpdir(), "creatives-migrations-"));
  let tenantId: string | undefined;
  let otherTenantId: string | undefined;
  try {
    const empty = await pool.query("select count(*)::int n from pg_tables where schemaname='public'");
    assert.equal(empty.rows[0].n, 0, "Use an empty dedicated test database.");
    await mkdir(join(migrationDir, "meta"));
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 2);
    await writeFile(join(migrationDir, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries as { tag: string }[])
      await cp(`drizzle/${entry.tag}.sql`, join(migrationDir, `${entry.tag}.sql`));
    await migrate(db, { migrationsFolder: migrationDir });
    const legacyTenant = await pool.query("insert into tenants(nome) values ('Attribution migration fixture') returning id");
    tenantId = legacyTenant.rows[0].id;
    const legacyCreative = await pool.query("insert into creatives(tenant_id,creative_key,name,campaign_key,adset_key,source) values ($1,'AD-1','Original','A','SET-A','csv') returning id", [tenantId]);
    await pool.query("insert into creative_metrics(tenant_id,creative_id,period_from,period_to,source,approved_sales,revenue_cents) values ($1,$2,'2026-10-01','2026-10-01','csv',3,77),($1,$2,'2026-10-01','2026-10-01','webhook',2,1000)", [tenantId, legacyCreative.rows[0].id]);
    for (const [id, campaign, status, revenue] of [["a", "A", "approved", 100], ["b", "B", "approved", 900], ["r", "B", "refunded", 200], ["unknown", null, "pending", null]] as const)
      await pool.query("insert into sales_events(tenant_id,event_id,occurred_at,status,currency,revenue_cents,profit_cents,creative_key,utm_campaign,source,raw) values ($1,$2,'2026-10-01T15:00:00-03:00',$3,'BRL',$4,$4,'AD-1',$5,'webhook','{}')", [tenantId, id, status, revenue, campaign]);
    await migrate(db, { migrationsFolder: "drizzle" });
    // Reapplying must not duplicate or rewrite already migrated data.
    await migrate(db, { migrationsFolder: "drizzle" });
    const period = { from: "2026-10-01", to: "2026-10-01", source: "webhook" as const };
    const revenue = async (campaignKey?: string) => (await getBenchmark(tenantId!, { ...period, ...(campaignKey ? { campaignKey } : {}) })).top.revenue_cents?.[0]?.value;
    assert.equal(await revenue("A"), "100");
    assert.equal(await revenue("B"), "700");
    assert.equal(await revenue(), undefined); // Pending unknown money remains NULL in totals.
    const legacyCsv = await db.select().from(creativeMetrics).where(eq(creativeMetrics.source, "csv"));
    assert.equal(legacyCsv[0].campaignKey, "");
    assert.equal(legacyCsv[0].revenueCents, 77n);
    // Replay all event jobs: no duplicate money, campaign contamination or tenant leakage.
    const events = await pool.query("select id from sales_events where tenant_id=$1", [tenantId]);
    for (const event of [...events.rows, ...events.rows]) await ingestEvent({ tenantId, eventId: event.id });
    assert.equal(await revenue("A"), "100");
    assert.equal(await revenue("B"), "700");
    const [other] = await db.insert(tenants).values({ nome: "Attribution isolation fixture" }).returning();
    otherTenantId = other.id;
    assert.deepEqual((await getBenchmark(other.id, period)).top, {});
    assert.deepEqual(await getCreatives(other.id, period), []);
    const tableA = await getCreatives(tenantId!, { ...period, campaignKey: "A" });
    const tableB = await getCreatives(tenantId!, { ...period, campaignKey: "B" });
    assert.equal(tableA[0].campaign_key, "A"); assert.equal(tableA[0].revenue_cents, "100");
    assert.equal(tableB[0].campaign_key, "B"); assert.equal(tableB[0].revenue_cents, "700");

    const [conversation] = await db.insert(conversations).values({ tenantId: tenantId!, title: "Test" }).returning();
    const [batch] = await db.insert(batches).values({ tenantId: tenantId!, conversationId: conversation.id, title: "Test", produtoNome: "Test", roundNumber: 1 }).returning();
    await db.insert(batchItems).values({ tenantId: tenantId!, batchId: batch.id, position: 1, creativeKey: "AD-1", ideia: "Test", g1: "Test", g2: "Test", g3: "Test", corpo: "Test", narrativa: "Test", awarenessEntry: "unaware", awarenessExit: "problem_aware", skeleton: "hipotese", hipotese: "Test", blocoTestado: "H", provaUsada: "None", duracaoEstimada: 10 });
    assert.equal((await getBatchResults(tenantId!, batch.id, { ...period, campaignKey: "A" })).items[0].metrics?.revenue_cents, "100");
    assert.equal((await getBatchResults(tenantId!, batch.id, { ...period, campaignKey: "B" })).items[0].metrics?.revenue_cents, "700");
    await assert.rejects(() => getBatchResults(other.id, batch.id, period), /não encontrada/);

    const common = { from: "2026-10-01", to: "2026-10-01", decimal: "dot" as const, moneyUnit: "cents" as const };
    const records = parseCsv({ ...common, csv: "key,campaign,sales,revenue\nAD-1,A,3,9007199254740993\nAD-1,B,4,900", mapping: { creative_key: "key", campaign_key: "campaign", approved_sales: "sales", revenue_cents: "revenue" } });
    await saveMetrics(tenantId!, records);
    const csvPeriod = { ...period, source: "csv" };
    assert.equal((await getBenchmark(tenantId!, { ...csvPeriod, campaignKey: "A" })).top.revenue_cents[0].value, "9007199254740993");
    assert.equal((await getBatchResults(tenantId!, batch.id, csvPeriod)).items[0].metrics?.revenue_cents, "9007199254741893");
    assert.equal((await getBatchResults(tenantId!, batch.id, { ...csvPeriod, campaignKey: "B" })).items[0].metrics?.approved_sales, "4");
    const missing = parseCsv({ ...common, from: "2026-10-02", to: "2026-10-02", csv: "key,sales\nAD-1,5", mapping: { creative_key: "key", approved_sales: "sales" } });
    await assert.rejects(() => saveMetrics(tenantId!, missing), /Informe a campanha/);
    // Missing optional metadata on a single-campaign creative preserves all known values.
    const single = parseCsv({ ...common, csv: "key,campaign,name,adset,sales\nSINGLE,A,Original,SET-A,1", mapping: { creative_key: "key", campaign_key: "campaign", creative_name: "name", adset_key: "adset", approved_sales: "sales" } });
    await saveMetrics(tenantId!, single);
    await saveMetrics(tenantId!, [{ ...missing[0], creative_key: "SINGLE" }]);
    const [preserved] = await db.select().from(creatives).where(eq(creatives.creativeKey, "SINGLE"));
    assert.equal(preserved.name, "Original"); assert.equal(preserved.campaignKey, "A"); assert.equal(preserved.adsetKey, "SET-A");
    assert.ok((await getBenchmark(tenantId!, { ...csvPeriod, campaignKey: "A" })).top.approved_sales.some((row) => row.creative_key === "SINGLE"));
    await assert.rejects(() => saveMetrics(tenantId!, [{ ...single[0], period_to: "2026-10-02" }]), /sobreposto/);
    await saveMetrics(tenantId!, [{ ...single[0], campaign_key: "B", period_to: "2026-10-02" }]); // Different campaigns can overlap.
    console.log("Campaign migration, replay, NULL/exact-money, CSV metadata and tenant/batch isolation checks passed.");
  } finally {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
    if (otherTenantId) await db.delete(tenants).where(eq(tenants.id, otherTenantId));
    await pool.end();
    await rm(migrationDir, { recursive: true, force: true });
  }

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
