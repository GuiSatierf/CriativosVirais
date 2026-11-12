import { spawn } from "node:child_process";
import { dbEnv } from "@/lib/env";

const connectTimeoutInSeconds = "10";

/**
 * Starts pg_dump or pg_restore against DATABASE_URL. The password goes in PGPASSWORD so it never
 * shows in the process list; the tool explains its own failures on stderr, in the process log.
 */
export function startPostgresTool(tool: "pg_dump" | "pg_restore", args: readonly string[]) {
  const url = new URL(dbEnv().DATABASE_URL);
  const password = decodeURIComponent(url.password);
  url.password = "";
  // A database that never accepts the connection fails the tool instead of holding the backup job.
  const child = spawn(tool, [...args, `--dbname=${url.toString()}`], {
    env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: connectTimeoutInSeconds },
    stdio: [tool === "pg_restore" ? "pipe" : "ignore", tool === "pg_dump" ? "pipe" : "inherit", "inherit"],
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  // Callers read the exit code when the stream ends; an early stream error must not leave it unhandled.
  exited.catch(() => undefined);
  return { child, exited };
}
