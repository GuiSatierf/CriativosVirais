import { z } from "zod";
import { desc, eq, isNull, not } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
import { hasMessages } from "@/lib/onboarding";
import { assertOwnProject } from "@/lib/projects";
import { tenantValues, tenantWhere } from "@/lib/tenant-scope";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z
        .object({
          title: z.string().trim().min(1).max(200).default("Nova conversa"),
          /** Opened from inside a project, the conversation starts in it. */
          projectId: z.uuid().nullable().default(null),
        })
        .strict(),
    );
    if (input.projectId != null) await assertOwnProject(tenantId, input.projectId);
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
    if (empty) {
      // The reused conversation moves to wherever the new one was asked for.
      await db
        .update(conversations)
        .set({ projectId: input.projectId })
        .where(tenantWhere(conversations, tenantId, eq(conversations.id, empty.id)));
      return json(empty);
    }
    const [conversation] = await db
      .insert(conversations)
      .values(tenantValues(tenantId, { title: input.title, projectId: input.projectId }))
      .returning({ id: conversations.id });
    return json(conversation, 201);
  });
}
