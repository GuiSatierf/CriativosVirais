import { z } from "zod";
import { desc, isNull, not } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
import { hasMessages } from "@/lib/onboarding";
import { tenantValues, tenantWhere } from "@/lib/tenant-scope";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z
        .object({
          title: z.string().trim().min(1).max(200).default("Nova conversa"),
        })
        .strict(),
    );
    // Reuses an untouched conversation so repeated clicks do not pile up empty ones.
    const [empty] = await db
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
    if (empty) return json(empty);
    const [conversation] = await db
      .insert(conversations)
      .values(tenantValues(tenantId, { title: input.title }))
      .returning({ id: conversations.id });
    return json(conversation, 201);
  });
}
