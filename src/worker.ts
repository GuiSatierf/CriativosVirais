import "dotenv/config";
import { startWorkerJobs, workOptions } from "./jobs";
import { analyzeVideo } from "./jobs/analyze-video";
import { ingestEvent } from "./jobs/ingest-event";
import { syncMetrics } from "./jobs/sync-metrics";
import { runBatchGeneration } from "./jobs/generate-batch";
import { pool } from "./db";
import { logError } from "./lib/log";
import { logMissingConfiguration } from "./lib/configuration-report";
import { purgeAccessLog } from "./jobs/purge-access-log";
async function main() {
  const boss = await startWorkerJobs();
  const handlers: Record<string, (data: unknown) => Promise<void>> = {
    "analyze-video": analyzeVideo,
    "transcribe-audio": analyzeVideo,
    "ingest-event": ingestEvent,
    "generate-batch": runBatchGeneration,
    "sync-metrics": (data) =>
      syncMetrics(data, (job) =>
        boss.send("sync-metrics", job, { singletonKey: job.integrationId }),
      ),
    "purge-access-log": purgeAccessLog,
  };
  for (const [name, handler] of Object.entries(handlers))
    await boss.work(name, workOptions(name), async ([job]) => {
      try {
        await handler(job.data);
      } catch (error) {
        // pg-boss stores the thrown error on the job row; keep raw details out of it.
        logError(name, error);
        throw new Error(`${name} failed`);
      }
    });
  await boss.schedule("sync-metrics", "0 */6 * * *", {});
  // Access records past the six months the Marco Civil requires are deleted once a day.
  await boss.schedule("purge-access-log", "30 4 * * *", {}, { tz: "America/Sao_Paulo" });
  console.info(
    "Worker ready: video analysis, sales ingestion and six-hour metrics sync.",
  );
  logMissingConfiguration("worker");
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await boss.stop({ timeout: 30_000 });
    await pool.end();
  }
  process.once("SIGTERM", () => {
    void stop();
  });
  process.once("SIGINT", () => {
    void stop();
  });
}
main().catch((error) => {
  logError("worker-startup", error);
  console.error(
    "Worker startup failed. Check database and queue configuration.",
  );
  process.exitCode = 1;
});
