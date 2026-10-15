import { and, desc, eq, exists, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  batches,
  clientContexts,
  conversations,
  creativeMetrics,
  integrations,
  messages,
} from "@/db/schema";
import { tenantWhere } from "./tenant-scope";

export type Onboarding = { context: boolean; results: boolean; batch: boolean };

/** First-run checklist: offer filled, results available, first batch generated. */
export async function getOnboarding(tenantId: string): Promise<Onboarding> {
  const [[context], [metric], [integration], [batch]] = await Promise.all([
    db
      .select({
        produtoNome: clientContexts.produtoNome,
        produto: clientContexts.produto,
      })
      .from(clientContexts)
      .where(tenantWhere(clientContexts, tenantId))
      .limit(1),
    db
      .select({ id: creativeMetrics.id })
      .from(creativeMetrics)
      .where(tenantWhere(creativeMetrics, tenantId))
      .limit(1),
    db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        tenantWhere(
          integrations,
          tenantId,
          eq(integrations.status, "connected"),
        ),
      )
      .limit(1),
    db
      .select({ id: batches.id })
      .from(batches)
      .where(tenantWhere(batches, tenantId))
      .limit(1),
  ]);
  return {
    context: Boolean(context?.produtoNome?.trim() || context?.produto?.trim()),
    results: Boolean(metric || integration),
    batch: Boolean(batch),
  };
}

/** Conversations with at least one message; empty ones stay out of the history. */
export function hasMessages(tenantId: string) {
  return exists(
    db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.conversationId, conversations.id),
        ),
      ),
  );
}

/** Most recent active conversations for navigation, newest first. */
export function getRecentConversations(tenantId: string, limit = 20) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      tenantWhere(
        conversations,
        tenantId,
        isNull(conversations.archivedAt),
        hasMessages(tenantId),
      ),
    )
    .orderBy(desc(conversations.createdAt), desc(conversations.id))
    .limit(limit);
}
