import { redirect } from "next/navigation";
import { desc, isNull, not } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { hasMessages } from "@/lib/onboarding";
import { requireTenant, tenantValues, tenantWhere } from "@/lib/tenant";
/** The hero: always lands on a fresh conversation, reusing an untouched one. */
export default async function ChatPage() {
  const { tenantId } = await requireTenant();
  let [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      tenantWhere(
        conversations,
        tenantId,
        isNull(conversations.archivedAt),
        not(hasMessages(tenantId)),
      ),
    )
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (!conversation)
    [conversation] = await db
      .insert(conversations)
      .values(tenantValues(tenantId, { title: "Nova conversa" }))
      .returning({ id: conversations.id });
  redirect(`/chat/${conversation.id}`);
}
