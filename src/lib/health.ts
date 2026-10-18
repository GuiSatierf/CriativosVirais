import { pool } from "@/db";
import { backupEnv } from "./env";
import { logError } from "./log";

// The worker is the only process with pg-boss scheduling on, and the scheduler stamps
// pgboss.version.cron_on about every 30 seconds, so a stale stamp means the worker stopped.
const workerSilentAfterSeconds = 180;
// A job that could have started and is still waiting means the queue is not being drained.
const queueStalledAfterSeconds = 600;
// The backup runs daily at 03:00; past 26 hours the last run failed or never started.
const backupStaleAfterSeconds = 26 * 3600;
const queryTimeoutMs = 5_000;

export type HealthReadings = {
  database: boolean;
  workerLastSeenSeconds: number | null;
  oldestWaitingJobSeconds: number | null;
  /** Undefined when backups are not configured; null when none has completed yet. */
  lastBackupSeconds?: number | null;
};
export type HealthProblem = "database" | "worker" | "queue" | "backup";

/** Turns raw readings into problems; a database outage hides the other two, which cannot be read. */
export function evaluateHealth(readings: HealthReadings) {
  if (!readings.database) return { ok: false, problems: ["database"] as HealthProblem[] };
  const problems: HealthProblem[] = [];
  const seconds = readings.workerLastSeenSeconds;
  if (seconds === null || seconds > workerSilentAfterSeconds) problems.push("worker");
  const waiting = readings.oldestWaitingJobSeconds;
  if (waiting !== null && waiting > queueStalledAfterSeconds) problems.push("queue");
  const backup = readings.lastBackupSeconds;
  if (backup === null || (backup !== undefined && backup > backupStaleAfterSeconds)) problems.push("backup");
  return { ok: problems.length === 0, problems };
}

async function readSeconds(sql: string): Promise<number | null> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Health query timed out")), queryTimeoutMs),
  );
  const result = await Promise.race([pool.query<{ seconds: number | null }>(sql), timeout]);
  return result.rows[0]?.seconds ?? null;
}

async function readOrNull(context: string, sql: string) {
  try {
    return await readSeconds(sql);
  } catch (error) {
    logError(context, error);
    return null;
  }
}

/** Reads database, worker and queue state with short timeouts; never throws. */
export async function readHealth(): Promise<HealthReadings> {
  try {
    await readSeconds("select 0 as seconds");
  } catch (error) {
    logError("health-database", error);
    return { database: false, workerLastSeenSeconds: null, oldestWaitingJobSeconds: null };
  }
  const workerLastSeenSeconds = await readOrNull(
    "health-worker",
    "select extract(epoch from now() - cron_on)::int as seconds from pgboss.version",
  );
  const oldestWaitingJobSeconds = await readOrNull(
    "health-queue",
    "select extract(epoch from now() - min(start_after))::int as seconds from pgboss.job where state = 'created' and start_after <= now()",
  );
  return {
    database: true,
    workerLastSeenSeconds,
    oldestWaitingJobSeconds,
    lastBackupSeconds: await readLastBackup(),
  };
}

/** Age of the last completed backup job; an invalid backup configuration counts as no backup. */
async function readLastBackup() {
  try {
    if (!backupEnv()) return undefined;
  } catch (error) {
    logError("health-backup", error);
    return null;
  }
  return readOrNull(
    "health-backup",
    "select extract(epoch from now() - max(completed_on))::int as seconds from pgboss.job where name = 'backup' and state = 'completed'",
  );
}
