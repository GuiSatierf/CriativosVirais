import Link from "next/link";
import { desc, isNotNull } from "drizzle-orm";
import { Archive } from "@/components/icons";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { requireTenant, tenantWhere } from "@/lib/tenant";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConversationActions } from "@/components/conversation-actions";

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function ArchivedConversationsView() {
  const { tenantId } = await requireTenant();
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(tenantWhere(conversations, tenantId, isNotNull(conversations.archivedAt)))
    .orderBy(desc(conversations.archivedAt), desc(conversations.id));
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Conversas arquivadas"
        description="Conversas fora do Histórico. Restaure quando quiser voltar a elas."
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhuma conversa arquivada"
          description="Use o menu de uma conversa no Histórico para arquivá-la."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <Link
                href={`/chat/${row.id}`}
                className="min-w-0 flex-1 rounded-md py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="block truncate text-sm font-medium">
                  {row.title}
                </span>
                {row.archivedAt && (
                  <span className="block text-xs text-muted-foreground">
                    Arquivada em{" "}
                    <time dateTime={row.archivedAt.toISOString()}>
                      {formatDate(row.archivedAt)}
                    </time>
                  </span>
                )}
              </Link>
              <ConversationActions
                conversation={{ id: row.id, title: row.title }}
                archived
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
