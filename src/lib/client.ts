import { z } from "zod";
import { toast } from "sonner";

const fallbackError = "Não foi possível concluir. Tente novamente.";
const offlineError = "Sem conexão com o servidor. Confira a internet e tente de novo.";

// Network failures ("Failed to fetch") and schema errors (JSON) are technical and in
// English; the screen only gets plain pt-BR messages.
async function send(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(offlineError);
  }
}

export async function api<T>(
  url: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await send(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(typeof error === "string" ? error : fallbackError);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(fallbackError);
  return parsed.data;
}
export const savedSchema = z.object({
  saved: z.boolean().optional(),
  queued: z.boolean().optional(),
  disconnected: z.boolean().optional(),
});
/** Shows a toast for a caught error, preferring the server's message. */
export function toastError(error: unknown, fallback = fallbackError) {
  toast.error(
    error instanceof Error && error.message ? error.message : fallback,
  );
}
/** YYYY-MM-DD in São Paulo time. */
export function spDay(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
export function recentPeriod() {
  return {
    from: spDay(new Date(Date.now() - 30 * 86400000)),
    to: spDay(),
    source: "csv" as "csv" | "webhook",
  };
}
/** Formats a YYYY-MM-DD day as dd/mm/aaaa. */
export function formatDay(day: string) {
  const [year, month, date] = day.slice(0, 10).split("-");
  return year && month && date ? `${date}/${month}/${year}` : day;
}
export function formatPeriod(from: string, to: string) {
  return from === to
    ? formatDay(from)
    : `${formatDay(from)} a ${formatDay(to)}`;
}
const percentMetrics = new Set(["ctr", "hook_rate", "body_rate"]);
/** Formats a metric value for display; money metrics are bigint cents. */
export function formatMetric(
  name: string,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined) return "Não disponível";
  if (name.endsWith("_cents")) return formatCents(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  // Rates are stored in percentage points (30 means 30%).
  if (percentMetrics.has(name))
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  // "R$ 3,98 por R$ 1": revenue for each real invested, in plain words.
  if (name === "roas")
    return `R$\u00a0${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por R$\u00a01`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
export function formatCents(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "Não disponível";
  if (typeof value === "number" && !Number.isInteger(value))
    return (value / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const n = BigInt(value);
  const absolute = n < 0n ? -n : n;
  const whole = (absolute / 100n).toLocaleString("pt-BR");
  return `${n < 0n ? "-" : ""}R$\u00a0${whole},${(absolute % 100n).toString().padStart(2, "0")}`;
}
