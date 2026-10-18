import "dotenv/config";
import { getJobs } from "../src/jobs";
import { backupEnv } from "../src/lib/env";

/** Queues a backup now (first run after setup, or before an update); the worker runs it. */
async function main() {
  if (!backupEnv()) throw new Error("Configure BACKUP_S3_* and BACKUP_ENCRYPTION_KEY first.");
  const boss = await getJobs();
  try {
    const id = await boss.send("backup", {});
    console.info(id ? "Backup queued. Follow it in the worker log." : "A backup is already queued or running.");
  } finally {
    await boss.stop({ graceful: false });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not queue the backup.");
  process.exitCode = 1;
});
