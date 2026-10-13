import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { handle, apiTenant, readJson, HttpError } from "@/lib/http";
import { textModel, providerOptions } from "@/lib/ai/model";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { chatTools } from "@/lib/ai/tools";
export const runtime = "nodejs";
export const maxDuration = 600;
const inputSchema = z.object({
  conversationId: z.uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.record(z.string(), z.unknown())).max(100),
      }),
    )
    .min(1)
    .max(100),
});
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    textModel();
    const input = await readJson(request, inputSchema);
    const incoming = input.messages.at(-1)!;
    if (
      incoming.role !== "user" ||
      incoming.parts.some((p) => p.type !== "text")
    )
      throw new HttpError(
        400,
        "Envie uma mensagem de texto ou transcreva o áudio primeiro.",
      );
    const text = z
      .string()
      .trim()
      .min(1)
      .max(12000)
      .parse(incoming.parts.map((p) => z.string().parse(p.text)).join("\n"));
    const turn = randomUUID();
    const [claimed] = await db
      .update(conversations)
      .set({
        processingToken: turn,
        processingUntil: new Date(Date.now() + 15 * 60_000),
      })
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.id, input.conversationId),
          sql`(${conversations.processingUntil} IS NULL OR ${conversations.processingUntil}<now())`,
        ),
      )
      .returning();
    if (!claimed) {
      const [exists] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.id, input.conversationId),
          ),
        );
      throw new HttpError(
        exists ? 409 : 404,
        exists
          ? "Aguarde a resposta atual nesta conversa."
          : "Conversa não encontrada.",
      );
    }
    const release = () =>
      db
        .update(conversations)
        .set({ processingToken: null, processingUntil: null })
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.id, input.conversationId),
            eq(conversations.processingToken, turn),
          ),
        );
    try {
      const savedUser: UIMessage = {
        id: randomUUID(),
        role: "user",
        parts: [{ type: "text", text }],
      };
      await db
        .insert(messages)
        .values({
          id: savedUser.id,
          tenantId,
          conversationId: input.conversationId,
          role: "user",
          content: savedUser,
          clientMessageId: incoming.id,
        })
        .onConflictDoNothing({
          target: [
            messages.tenantId,
            messages.conversationId,
            messages.clientMessageId,
          ],
        });
      const stored = await db
        .select({ content: messages.content })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messages.conversationId, input.conversationId),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(40);
      // History comes exclusively from this tenant's database. Client-supplied assistant/tool messages are ignored.
      const modelMessages = stored
        .reverse()
        .map((r) => {
          const m = r.content as UIMessage;
          return {
            role:
              m.role === "assistant"
                ? ("assistant" as const)
                : ("user" as const),
            content: m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("\n"),
          };
        })
        .filter((m) => m.content);
      const system = await buildSystemPrompt(tenantId);
      const stream = createUIMessageStream({
        generateId: randomUUID,
        onError: () =>
          "Não foi possível concluir a resposta. Confira a configuração ou tente novamente.",
        execute: async ({ writer }) => {
          const result = streamText({
            model: textModel(),
            providerOptions,
            system,
            messages: modelMessages,
            tools: chatTools(tenantId, input.conversationId, writer),
            stopWhen: stepCountIs(8),
            maxOutputTokens: 6000,
            abortSignal: request.signal,
            onAbort: async () => {
              await release();
            },
          });
          // Internal tool inputs/results and reasoning never cross the browser boundary; public cards are written separately.
          writer.merge(
            result
              .toUIMessageStream({ sendReasoning: false, sendSources: false })
              .pipeThrough(
                new TransformStream({
                  transform(chunk, controller) {
                    if (
                      chunk.type.startsWith("tool-") ||
                      chunk.type.startsWith("reasoning-") ||
                      chunk.type.startsWith("source-")
                    )
                      return;
                    controller.enqueue(chunk);
                  },
                }),
              ),
          );
        },
        onEnd: async ({ responseMessage }) => {
          try {
            await db.insert(messages).values({
              id: randomUUID(),
              tenantId,
              conversationId: input.conversationId,
              role: "assistant",
              content: responseMessage,
            });
          } finally {
            await release();
          }
        },
      });
      return createUIMessageStreamResponse({
        stream,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      await release();
      throw error;
    }
  });
}
