import { pool } from "@/db";
import { logError } from "./log";

// The worker is the only process with pg-boss scheduling on, and the scheduler stamps
// pgboss.version.cron_on about every 30 seconds, so a stale stamp means the worker stopped.
const workerSilentAfterSeconds = 180;
// A job that could have started (new or due for a retry) and is still waiting means the queue is not being drained.
const queueStalledAfterSeconds = 600;
const queryTimeoutMs = 5_000;
// The route is public: a burst of requests shares one reading instead of piling queries that
// can hold pooled connections well past the 5 s answer while the database is slow.
const readingReuseMs = 10_000;

export type HealthReadings = {
  database: boolean;
  workerLastSeenSeconds: number | null;
  oldestWaitingJobSeconds: number | null;
};
export type HealthProblem = "database" | "worker" | "queue";

/** Turns raw readings into problems; a database outage hides the other two, which cannot be read. */
export function evaluateHealth(readings: HealthReadings) {
  if (!readings.database) return { ok: false, problems: ["database"] as HealthProblem[] };
  const problems: HealthProblem[] = [];
  const seconds = readings.workerLastSeenSeconds;
  if (seconds === null || seconds > workerSilentAfterSeconds) problems.push("worker");
  const waiting = readings.oldestWaitingJobSeconds;
  if (waiting !== null && waiting > queueStalledAfterSeconds) problems.push("queue");
  return { ok: problems.length === 0, problems };
}

/** Named so the log says which failure it was; only the name of foreign errors is logged. */
class HealthQueryTimeoutError extends Error {
  name = "HealthQueryTimeoutError";
}

async function readSeconds(sql: string): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HealthQueryTimeoutError()), queryTimeoutMs);
  });
  try {
    const result = await Promise.race([pool.query<{ seconds: number | null }>(sql), timeout]);
    return result.rows[0]?.seconds ?? null;
  } finally {
    clearTimeout(timer);
  }
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
  const [workerLastSeenSeconds, oldestWaitingJobSeconds] = await Promise.all([
    readOrNull(
      "health-worker",
      "select extract(epoch from now() - cron_on)::int as seconds from pgboss.version",
    ),
    readOrNull(
      "health-queue",
      "select extract(epoch from now() - min(start_after))::int as seconds from pgboss.job where state in ('created', 'retry') and start_after <= now()",
    ),
  ]);
  return { database: true, workerLastSeenSeconds, oldestWaitingJobSeconds };
}

/** Calls `load` at most once per window; callers inside the window share its promise. */
export function reuseFor<T>(windowMs: number, load: () => Promise<T>, now: () => number = Date.now) {
  let last: { at: number; value: Promise<T> } | undefined;
  return () => {
    const at = now();
    if (last !== undefined && at - last.at < windowMs) return last.value;
    last = { at, value: load() };
    return last.value;
  };
}

export const readSharedHealth = reuseFor(readingReuseMs, readHealth);
