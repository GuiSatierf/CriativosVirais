import { z } from "zod";
export async function api<T>(
  url: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Não foi possível concluir.",
    );
  return schema.parse(data);
}
export const savedSchema = z.object({
  saved: z.boolean().optional(),
  queued: z.boolean().optional(),
  disconnected: z.boolean().optional(),
});
export function recentPeriod() {
  const to = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const from = new Date(Date.now() - 30 * 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Sao_Paulo" },
  );
  return { from, to, source: "csv" as "csv" | "webhook" };
}
export function formatCents(value: string | null) {
  if (value === null) return "Não disponível";
  const n = BigInt(value);
  const absolute = n < 0n ? -n : n;
  const whole = (absolute / 100n).toLocaleString("pt-BR");
  return `${n < 0n ? "-" : ""}R$ ${whole},${(absolute % 100n).toString().padStart(2, "0")}`;
}
