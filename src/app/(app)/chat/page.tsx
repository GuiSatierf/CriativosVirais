import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { requireTenant } from "@/lib/tenant";
export default async function ChatPage() {
  const { tenantId } = await requireTenant();
  let [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.tenantId, tenantId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (!conversation)
    [conversation] = await db
      .insert(conversations)
      .values({ tenantId, title: "Nova conversa" })
      .returning({ id: conversations.id });
  redirect(`/chat/${conversation.id}`);
}
