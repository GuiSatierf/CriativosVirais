import { randomUUID } from "node:crypto";
import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, rateLimit } from "@/db/schema";
import { dailyUploadLimit } from "./app-settings";
import { TooManyRequestsError } from "./errors";
import { tenantWhere } from "./tenant-scope";

const windowInMs = 60_000;
const saoPauloDayStart = sql`date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`;

// Per account and per minute: far above what a person does by hand, low enough to stop a loop.
const requestLimits = {
  chat: { max: 20, message: "Você enviou muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo." },
  upload: { max: 30, message: "Você enviou muitos arquivos em pouco tempo. Aguarde um minuto e tente de novo." },
  import: { max: 10, message: "Você importou muitas planilhas em pouco tempo. Aguarde um minuto e tente de novo." },
} as const;
type LimitedRoute = keyof typeof requestLimits;

/**
 * Counts one request from the account on the route and refuses it past the route's limit.
 *
 * @remarks
 * Fixed one-minute windows kept in Better Auth's `rate_limit` table, so every app process
 * shares the count. The `app:` key prefix never matches Better Auth's own `<ip><path>` keys,
 * and `last_request` holds the window start here.
 *
 * @param tenantId - The account resolved from the server session.
 * @param route - Which limited route the request is for.
 * @throws {TooManyRequestsError} When the account already used the route's limit in this window.
 */
export async function assertRequestLimit(tenantId: string, route: LimitedRoute) {
  const now = Date.now();
  const windowStart = now - windowInMs;
  const expired = sql`${rateLimit.lastRequest} <= ${windowStart}`;
  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key: `app:${route}:${tenantId}`, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
  if (row == null) throw new Error(`Request limit upsert returned no row for route ${route}`);
  const limit = requestLimits[route];
  if (row.count <= limit.max) return;
  const retryAfterInSeconds = Math.max(1, Math.ceil((row.lastRequest + windowInMs - now) / 1000));
  throw new TooManyRequestsError(limit.message, retryAfterInSeconds);
}

/**
 * Refuses a new upload once the account sent the panel's daily limit of files.
 *
 * @remarks
 * Every presigned upload creates its asset row, so today's rows are the files already sent.
 * The day follows São Paulo time, and Retry-After points at the next midnight there.
 *
 * @param tenantId - The account resolved from the server session.
 * @throws {TooManyRequestsError} When the account already sent its daily limit of files.
 */
export async function assertDailyUploadLimit(tenantId: string) {
  const [limit, [today]] = await Promise.all([
    dailyUploadLimit(),
    db
      .select({
        sent: sql<number>`count(*)::int`,
        secondsLeft: sql<number>`ceil(extract(epoch FROM ${saoPauloDayStart} + interval '1 day' - now()))::int`,
      })
      .from(assets)
      .where(tenantWhere(assets, tenantId, gte(assets.createdAt, saoPauloDayStart))),
  ]);
  if (today == null) throw new Error("Daily upload count returned no row");
  if (today.sent < limit) return;
  throw new TooManyRequestsError(
    `Você chegou ao limite de ${limit.toLocaleString("pt-BR")} envios de hoje. Ele renova amanhã.`,
    Math.max(1, today.secondsLeft),
  );
}
