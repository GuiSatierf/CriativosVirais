import { evaluateHealth, readHealth } from "@/lib/health";

/**
 * Full health for an external uptime monitor: database, worker heartbeat and queue backlog.
 * 503 names the failing part without revealing configuration. The container healthcheck keeps
 * using /api/health, which only confirms the process responds.
 */
export async function GET() {
  const { ok, problems } = evaluateHealth(await readHealth());
  return Response.json(
    { status: ok ? "ok" : "degraded", problems },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
