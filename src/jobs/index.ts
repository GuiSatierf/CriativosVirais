import { PgBoss, type QueueOptions, type WorkOptions } from "pg-boss";
import { pool } from "@/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { dbEnv } from "@/lib/env";
import { logError } from "@/lib/log";
export const queues = ["analyze-video", "ingest-event", "sync-metrics", "generate-batch", "purge-access-log", "backup"] as const;
export const queueOptions: QueueOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 1800,
};
// A batch retried after a failure would pay the model again, and generation plus review can take
// longer than the default expiry; a failure is shown on the chat card instead.
const perQueue: Partial<Record<(typeof queues)[number], QueueOptions>> = {
  "generate-batch": { retryLimit: 0, expireInSeconds: 3600 },
  // A first backup copies every stored video; later ones only what is new. One retry after 15
  // minutes: the queue holds one backup at a time, so a longer wait would also block a manual run.
  backup: { retryLimit: 1, retryDelay: 900, retryBackoff: false, expireInSeconds: 3 * 3600 },
};
// A batch generation can hold its slot for up to 30 minutes; one at a time would make every
// other tenant's batch wait behind it.
const perQueueWork: Partial<Record<(typeof queues)[number], WorkOptions>> = {
  "generate-batch": { localConcurrency: 4 },
};
/** Options for boss.work: one job per fetch, with more parallel slots for long queues. */
export function workOptions(name: string): WorkOptions {
  return { batchSize: 1, ...perQueueWork[name as (typeof queues)[number]] };
}
function createBoss(sendOnly: boolean) {
  const boss = new PgBoss({
    connectionString: dbEnv().DATABASE_URL,
    ...(sendOnly ? { supervise: false, schedule: false, migrate: false } : {}),
  });
  boss.on("error", (error) => logError("job-queue", error));
  return boss;
}
/** Worker instance: installs pg-boss, owns queue configuration, maintenance and cron. */
export async function startWorkerJobs() {
  const boss = createBoss(false);
  await boss.start();
  for (const name of queues) {
    const options = { ...queueOptions, ...perQueue[name] };
    await boss.createQueue(name, {
      ...options,
      policy: name === "sync-metrics" ? "standard" : "exclusive",
    });
    await boss.updateQueue(name, options);
  }
  return boss;
}
/**
 * "Sync now" options: the sync-metrics queue uses the standard policy, where singletonKey
 * alone does not deduplicate, so repeated clicks throttle to one UTMify call per integration
 * per five-minute slot.
 */
export function manualSyncOptions(integrationId: string) {
  return { singletonKey: integrationId, singletonSeconds: 300 };
}
let sender: Promise<PgBoss> | undefined;
/** App instance: send-only. Queues exist once the worker has started at least once. */
export function getJobs() {
  return (sender ??= createBoss(true)
    .start()
    .catch((error) => {
      sender = undefined;
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
