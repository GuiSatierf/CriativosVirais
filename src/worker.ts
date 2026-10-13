import "dotenv/config";
import { startJobs } from "./jobs";
async function main() {
  const boss = await startJobs();
  console.info("Worker ready. Stage 1 has no registered processing jobs.");
  let stopping = false;
  const keepAlive = setInterval(() => {}, 60_000);
  async function stop() {
    if (stopping) return;
    stopping = true;
    clearInterval(keepAlive);
    await boss.stop();
  }
  process.once("SIGTERM", () => {
    void stop();
  });
  process.once("SIGINT", () => {
    void stop();
  });
}
main().catch(() => {
  console.error("Worker startup failed. Check database configuration.");
  process.exitCode = 1;
});
