import { z } from "zod";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { requireTenant, tenantWhere } from "@/lib/tenant";
import { Chat } from "@/components/chat";
import { getHome } from "@/lib/home";
import { isModelConfigured } from "@/lib/ai/model";
export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { tenantId, user } = await requireTenant();
  const parsed = z.uuid().safeParse((await params).conversationId);
  if (!parsed.success) notFound();
  const [conversation] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(
      tenantWhere(conversations, tenantId, eq(conversations.id, parsed.data)),
    );
  if (!conversation) notFound();
  const stored = await db
    .select({ content: messages.content })
    .from(messages)
    .where(
      tenantWhere(
        messages,
        tenantId,
        eq(messages.conversationId, conversation.id),
      ),
    )
    .orderBy(asc(messages.createdAt), asc(messages.id));
  // The hero (status and next actions) only shows before the first message.
  const home = stored.length ? undefined : await getHome(tenantId);
  return (
    <Chat
      home={home}
      key={conversation.id}
      conversationId={conversation.id}
      title={conversation.title}
      initialMessages={stored.map((r) => r.content as UIMessage)}
      configured={isModelConfigured()}
      firstName={user.name.trim().split(/\s+/)[0] || undefined}
    />
  );
}
