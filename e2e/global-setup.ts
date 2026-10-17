import { spawn } from "node:child_process";

// Starts the queue worker (dist/worker.js, built by test:e2e) so webhook sales are processed
// like in production. The returned function stops it when the suite ends.
export default async function globalSetup() {
  const worker = spawn(process.execPath, ["dist/worker.js"], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Worker did not start within 60 s.")), 60_000);
    worker.stdout.on("data", (chunk: Buffer) => {
      if (!chunk.toString().includes("Worker ready")) return;
      clearTimeout(timer);
      resolve();
    });
    worker.stderr.on("data", (chunk: Buffer) => process.stderr.write(`[worker] ${chunk}`));
    worker.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Worker exited with code ${code}.`));
    });
  });
  return async () => {
    worker.removeAllListeners("exit");
    worker.kill();
  };
}
