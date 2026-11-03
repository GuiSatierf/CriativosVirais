import { gte, sql } from "drizzle-orm";
import type { LanguageModelMiddleware } from "ai";
import { db } from "@/db";
import { aiPurpose, aiUsage } from "@/db/schema";
import { aiMonthlyLimitCents } from "../app-settings";
import { spDay } from "../dates";
import { aiBudgetEnv } from "../env";
import { DomainError } from "../errors";
import { logError } from "../log";
import { tenantValues, tenantWhere } from "../tenant-scope";

export type AiPurpose = (typeof aiPurpose.enumValues)[number];
/** Who pays for a model call, and what it was for. */
export type MeteredCall = { tenantId: string; purpose: AiPurpose };

type TokenCounts = { input: number | null; cachedInput: number | null; output: number | null };
type ModelUsage = {
  inputTokens: { total: number | undefined; cacheRead: number | undefined };
  outputTokens: { total: number | undefined };
};

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthStart = sql`date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`;

/** Cost in thousandths of a cent, rounded up so many small calls never add up to less than was spent. */
// A count the provider did not report adds nothing to the cost; the record keeps it as NULL.
export function costMillicents(tokens: TokenCounts, prices = aiBudgetEnv()) {
  const millicents =
    ((tokens.input ?? 0) * prices.AI_PRICE_INPUT_CENTS_PER_MTOK +
      (tokens.cachedInput ?? 0) * prices.AI_PRICE_CACHED_INPUT_CENTS_PER_MTOK +
      (tokens.output ?? 0) * prices.AI_PRICE_OUTPUT_CENTS_PER_MTOK) /
    1000;
  return BigInt(Math.ceil(millicents));
}

// Providers may omit a count; it stays unknown (NULL) instead of blocking the reply.
function tokenCounts(usage: ModelUsage): TokenCounts {
  const total = usage.inputTokens.total;
  const output = usage.outputTokens.total ?? null;
  if (total == null) return { input: null, cachedInput: null, output };
  const cachedInput = Math.min(usage.inputTokens.cacheRead ?? 0, total);
  return { input: total - cachedInput, cachedInput, output };
}

/** "1º de novembro": the day the São Paulo month turns and the budget starts over. */
function renewalLabel(today = spDay()) {
  const [year, month] = today.split("-").map(Number);
  const next = new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 1));
  return `1º de ${monthName.format(next)}`;
}

async function spentThisMonthMillicents(tenantId: string) {
  const [row] = await db
    .select({ spent: sql<string>`coalesce(sum(${aiUsage.costMillicents}), 0)` })
    .from(aiUsage)
    .where(tenantWhere(aiUsage, tenantId, gte(aiUsage.createdAt, monthStart)));
  return BigInt(row?.spent ?? "0");
}

/** Refuses a model call once the operation has spent its monthly AI budget, as set in the panel. */
export async function assertAiBudget(tenantId: string) {
  const [limitCents, spent] = await Promise.all([aiMonthlyLimitCents(), spentThisMonthMillicents(tenantId)]);
  if (spent < limitCents * 1000n) return;
  throw new DomainError(
    "limit_reached",
    `Você usou todo o limite de IA deste mês. Ele renova em ${renewalLabel()}.`,
  );
}

async function recordAiUsage(call: MeteredCall, usage: ModelUsage) {
  const tokens = tokenCounts(usage);
  try {
    await db.insert(aiUsage).values(
      tenantValues(call.tenantId, {
        purpose: call.purpose,
        inputTokens: tokens.input,
        cachedInputTokens: tokens.cachedInput,
        outputTokens: tokens.output,
        costMillicents: costMillicents(tokens),
      }),
    );
  } catch (error) {
    // The reply already happened; a lost record must not turn it into an error.
    logError(`ai-usage tenant=${call.tenantId}`, error);
  }
}

/** Checks the budget before every model call and records what each one cost. */
export function meteringMiddleware(call: MeteredCall): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      await assertAiBudget(call.tenantId);
      const result = await doGenerate();
      await recordAiUsage(call, result.usage);
      return result;
    },
    wrapStream: async ({ doStream }) => {
      await assertAiBudget(call.tenantId);
      const { stream, ...rest } = await doStream();
      const metered = stream.pipeThrough(
        new TransformStream({
          async transform(part, controller) {
            if (part.type === "finish") await recordAiUsage(call, part.usage);
            controller.enqueue(part);
          },
        }),
      );
      return { stream: metered, ...rest };
    },
  };
}
