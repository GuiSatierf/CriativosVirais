import "dotenv/config";
import { startJobs } from "./jobs";
import { analyzeVideo } from "./jobs/analyze-video";
import { ingestEvent } from "./jobs/ingest-event";
import { syncMetrics } from "./jobs/sync-metrics";
import { pool } from "./db";
async function main() {
  const boss = await startJobs();
  await boss.work("analyze-video", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await analyzeVideo(job.data);
  });
  await boss.work("ingest-event", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await ingestEvent(job.data);
  });
  await boss.work("sync-metrics", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await syncMetrics(job.data);
  });
  await boss.schedule("sync-metrics", "0 */6 * * *", {});
  console.info(
    "Worker ready: video analysis, sales ingestion and six-hour metrics sync.",
  );
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
main().catch(() => {
  console.error(
    "Worker startup failed. Check database and queue configuration.",
  );
  process.exitCode = 1;
});
