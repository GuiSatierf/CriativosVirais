// Runs once when a Next.js server instance starts (see the Next.js instrumentation guide).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logMissingConfiguration } = await import("./lib/configuration-report");
  logMissingConfiguration("app");
}
