import { PgBoss } from "pg-boss";
import { pool } from "@/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
export async function startJobs() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on("error", () => console.error("Job queue error"));
  await boss.start();
  for (const name of ["analyze-video", "ingest-event", "sync-metrics"]) {
    await boss.createQueue(name, {
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 1800,
      policy: name === "sync-metrics" ? "standard" : "exclusive",
    });
    await boss.updateQueue(name, {
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 1800,
    });
  }
  return boss;
}
let jobs: Promise<PgBoss> | undefined;
export function getJobs() {
  return (jobs ??= startJobs().catch((error) => {
    jobs = undefined;
    throw error;
  }));
}
// Domain writes and enqueue commit together, so crashes cannot acknowledge an unqueued event.
export async function jobTransaction<T>(
  fn: (
    tx: NodePgDatabase<typeof schema>,
    connection: {
      executeSql: (
        text: string,
        values?: unknown[],
      ) => Promise<{ rows: Record<string, unknown>[] }>;
    },
  ) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(drizzle(client, { schema }), {
      executeSql: (text, values) => client.query(text, values),
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
