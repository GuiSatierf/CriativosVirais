import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
if (!existsSync(".next/standalone/server.js")) {
  console.error("Run npm run build before npm start.");
  process.exit(1);
}
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: { ...process.env, HOSTNAME: "0.0.0.0" },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => child.kill(signal));
child.once("exit", (code) => process.exit(code ?? 0));
