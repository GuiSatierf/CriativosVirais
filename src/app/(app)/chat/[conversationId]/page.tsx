import { z } from "zod";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
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
    .select({ id: conversations.id, title: conversations.title })
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
  const recent = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(eq(conversations.tenantId, tenantId))
    .orderBy(desc(conversations.createdAt), desc(conversations.id))
    .limit(20);
  if (!recent.some((item) => item.id === conversation.id)) recent.push(conversation);
  return (
    <Chat
      key={conversation.id}
      conversationId={conversation.id}
      conversations={recent}
      initialMessages={stored.map((r) => r.content as UIMessage)}
      configured={Boolean(
        process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL_TEXT,
      )}
    />
  );
}
