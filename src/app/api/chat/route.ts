import { z } from "zod";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { db } from "@/db";
import { assets, conversations, messages } from "@/db/schema";
import { handle, apiTenant, readJson, HttpError } from "@/lib/http";
import {
  assertModelConfigured,
  textModel,
  providerOptions,
  onModelError,
} from "@/lib/ai/model";
import { assertAiBudget } from "@/lib/ai/budget";
import {
  attachmentsSchema,
  buildSystemPrompt,
  messageAttachments,
  messageText,
} from "@/lib/ai/system-prompt";
import { chatTools } from "@/lib/ai/tools";
import { logError } from "@/lib/log";
import { tenantValues, tenantWhere } from "@/lib/tenant-scope";
import { looksLikeSecret, secretWarning } from "@/lib/secrets";
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
        metadata: z.unknown().optional(),
      }),
    )
    .min(1)
    .max(100),
});
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    assertModelConfigured();
    // Refused up front with its own message; the model wrapper checks again on every step.
    await assertAiBudget(tenantId);
    const input = await readJson(request, inputSchema);
    const incoming = input.messages.at(-1)!;
    const attachments = attachmentsSchema.optional().safeParse(incoming.metadata);
    if (!attachments.success)
      throw new HttpError(400, "Anexe até cinco vídeos por mensagem.");
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
    // Refused before storage so a pasted key never reaches the model or the history.
    if (looksLikeSecret(text)) throw new HttpError(400, secretWarning);
    const assetIds = [...new Set(attachments.data?.assetIds)];
    if (assetIds.length) {
      const owned = await db
        .select({ id: assets.id })
        .from(assets)
        .where(
          tenantWhere(assets, tenantId, inArray(assets.id, assetIds), eq(assets.kind, "video")),
        );
      if (owned.length !== assetIds.length)
        throw new HttpError(400, "Não encontramos um dos vídeos anexados. Envie o vídeo novamente.");
    }
    const turnSignal = AbortSignal.any([request.signal, AbortSignal.timeout(600_000)]);
    const turn = randomUUID();
    const [claimed] = await db
      .update(conversations)
      .set({
        title: sql`CASE WHEN ${conversations.title}='Nova conversa' THEN ${text.slice(0, 80)} ELSE ${conversations.title} END`,
        processingToken: turn,
        processingUntil: new Date(Date.now() + 15 * 60_000),
      })
      .where(
        tenantWhere(
          conversations,
          tenantId,
          eq(conversations.id, input.conversationId),
          sql`(${conversations.processingUntil} IS NULL OR ${conversations.processingUntil}<now())`,
        ),
      )
      .returning();
    if (!claimed) {
      const [exists] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(tenantWhere(conversations, tenantId, eq(conversations.id, input.conversationId)));
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
          tenantWhere(
            conversations,
            tenantId,
            eq(conversations.id, input.conversationId),
            eq(conversations.processingToken, turn),
          ),
        );
    try {
      const savedUser: UIMessage = {
        id: randomUUID(),
        role: "user",
        parts: [{ type: "text", text }],
        ...(assetIds.length ? { metadata: { assetIds } } : {}),
      };
      await db
        .insert(messages)
        .values(
          tenantValues(tenantId, {
            id: savedUser.id,
            conversationId: input.conversationId,
            role: "user" as const,
            content: savedUser,
            clientMessageId: incoming.id,
          }),
        )
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
        .where(tenantWhere(messages, tenantId, eq(messages.conversationId, input.conversationId)))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(40);
      // History comes exclusively from this tenant's database. Client-supplied assistant/tool messages are ignored.
      // Attachment ids reach the model only in this copy, never in the stored or displayed text.
      const modelMessages = stored
        .reverse()
        .map(({ content }) => {
          const assistant = (content as Partial<UIMessage>).role === "assistant";
          const attached = assistant ? [] : messageAttachments(content);
          return {
            role: assistant ? ("assistant" as const) : ("user" as const),
            content: [
              messageText(content),
              attached.length ? `[Vídeos anexados nesta mensagem, asset_id: ${attached.join(", ")}]` : "",
            ].filter(Boolean).join("\n"),
          };
        })
        .filter((m) => m.content);
      const system = await buildSystemPrompt(tenantId, input.conversationId, {
        embedConversation: false,
      });
      const stream = createUIMessageStream({
        generateId: randomUUID,
        onError: (error) => {
          logError("chat", error);
          return "Não foi possível concluir a resposta. Tente novamente em instantes.";
        },
        execute: async ({ writer }) => {
          const tools = chatTools(tenantId, input.conversationId, writer);
          const result = streamText({
            model: textModel({ tenantId, purpose: "chat" }),
            providerOptions,
            onError: onModelError,
            instructions: system,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(8),
            maxOutputTokens: 6000,
            abortSignal: turnSignal,
            onAbort: async () => {
              await release();
            },
          });
          // Internal tool inputs/results and reasoning never cross the browser boundary; public cards are written separately.
          writer.merge(
            toUIMessageStream({ stream: result.stream, tools, sendReasoning: false, sendSources: false })
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
            await db.insert(messages).values(
              tenantValues(tenantId, {
                id: randomUUID(),
                conversationId: input.conversationId,
                role: "assistant" as const,
                content: responseMessage,
              }),
            );
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
