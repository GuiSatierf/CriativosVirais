import { z } from "zod";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { requireTenant } from "@/lib/tenant";
import { Chat } from "@/components/chat";
export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { tenantId } = await requireTenant();
  const parsed = z.uuid().safeParse((await params).conversationId);
  if (!parsed.success) notFound();
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.id, parsed.data),
      ),
    );
  if (!conversation) notFound();
  const stored = await db
    .select({ content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.conversationId, conversation.id),
      ),
    )
    .orderBy(asc(messages.createdAt), asc(messages.id));
  return (
    <Chat
      key={conversation.id}
      conversationId={conversation.id}
      initialMessages={stored.map((r) => r.content as UIMessage)}
      configured={Boolean(
        process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL_TEXT,
      )}
    />
  );
}
