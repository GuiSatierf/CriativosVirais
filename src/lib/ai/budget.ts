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
type WrapStream = NonNullable<LanguageModelMiddleware["wrapStream"]>;
type StreamPart = Awaited<ReturnType<Parameters<WrapStream>[0]["doStream"]>>["stream"] extends ReadableStream<infer Part>
  ? Part
  : never;

/** What a streamed step used: the provider's count, or an estimate when the stream stopped before reporting it. */
export type StreamUsage = { reported: ModelUsage } | { estimated: { inputTokens: number; outputTokens: number } };

// Fewer characters per token than Portuguese text really uses, so an estimate errs toward counting more.
const estimatedCharsPerToken = 3;

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

async function recordAiUsage(call: MeteredCall, usage: StreamUsage) {
  // An estimate only prices the step; its token counts stay unknown (NULL) instead of looking measured.
  const tokens = "reported" in usage ? tokenCounts(usage.reported) : { input: null, cachedInput: null, output: null };
  const cost =
    "reported" in usage
      ? costMillicents(tokens)
      : costMillicents({ input: usage.estimated.inputTokens, cachedInput: 0, output: usage.estimated.outputTokens });
  try {
    await db.insert(aiUsage).values(
      tenantValues(call.tenantId, {
        purpose: call.purpose,
        inputTokens: tokens.input,
        cachedInputTokens: tokens.cachedInput,
        outputTokens: tokens.output,
        costMillicents: cost,
      }),
    );
  } catch (error) {
    // The reply already happened; a lost record must not turn it into an error.
    logError(`ai-usage tenant=${call.tenantId}`, error);
  }
}

/**
 * Passes a model stream through and reports its usage exactly once.
 *
 * @remarks
 * The provider reports usage only in the final `finish` part. When the client closes the tab or the
 * turn times out, the stream is cancelled before that part, yet the provider already read the prompt
 * and wrote part of the answer, so the step is then estimated from the prompt and the text received.
 *
 * @param promptChars - Length of everything sent to the model in this step (prompt and tools).
 */
export function meterStream(
  stream: ReadableStream<StreamPart>,
  promptChars: number,
  record: (usage: StreamUsage) => Promise<void>,
) {
  let outputChars = 0;
  let recorded = false;
  const recordOnce = async (usage: StreamUsage) => {
    if (recorded) return;
    recorded = true;
    await record(usage);
  };
  const recordEstimate = () =>
    recordOnce({
      estimated: {
        inputTokens: Math.ceil(promptChars / estimatedCharsPerToken),
        outputTokens: Math.ceil(outputChars / estimatedCharsPerToken),
      },
    });
  // TypeScript's DOM types still lack the transformer's cancel hook, which Node 22 calls when the
  // reader cancels or the provider stream fails; a variable avoids the literal's excess property check.
  const transformer = {
    async transform(part: StreamPart, controller: TransformStreamDefaultController<StreamPart>) {
      if (part.type === "finish") await recordOnce({ reported: part.usage });
      if (part.type === "text-delta" || part.type === "reasoning-delta" || part.type === "tool-input-delta")
        outputChars += part.delta.length;
      controller.enqueue(part);
    },
    flush: recordEstimate,
    cancel: recordEstimate,
  };
  return stream.pipeThrough(new TransformStream<StreamPart, StreamPart>(transformer));
}

/** Checks the budget before every model call and records what each one cost. */
export function meteringMiddleware(call: MeteredCall): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      await assertAiBudget(call.tenantId);
      const result = await doGenerate();
      await recordAiUsage(call, { reported: result.usage });
      return result;
    },
    wrapStream: async ({ doStream, params }) => {
      await assertAiBudget(call.tenantId);
      const { stream, ...rest } = await doStream();
      const promptChars = JSON.stringify(params.prompt).length + JSON.stringify(params.tools ?? []).length;
      return { stream: meterStream(stream, promptChars, (usage) => recordAiUsage(call, usage)), ...rest };
    },
  };
}
