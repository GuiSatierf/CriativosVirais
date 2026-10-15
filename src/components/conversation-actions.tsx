"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Pencil,
  Trash2,
} from "@/components/icons";
import { toast } from "sonner";
import { z } from "zod";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RenameDialog } from "@/components/rename-dialog";
import { api, savedSchema } from "@/lib/client";
import { cn } from "@/lib/utils";

const deletedSchema = z.object({ deleted: z.boolean() });

/** Rename, archive/restore and delete for one conversation. */
export function ConversationActions({
  conversation,
  archived = false,
  className,
}: {
  conversation: { id: string; title: string };
  archived?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<"rename" | "delete">();
  const url = `/api/conversations/${conversation.id}`;
  const current = pathname === `/chat/${conversation.id}`;

  async function rename(title: string) {
    await api(url, savedSchema, { title }, "PATCH");
    router.refresh();
  }

  async function setArchived(next: boolean) {
    try {
      await api(url, savedSchema, { archived: next }, "PATCH");
      toast.success(next ? "Conversa arquivada." : "Conversa restaurada.");
      if (next && current) router.push("/chat");
      router.refresh();
    } catch {
      toast.error("Não foi possível atualizar a conversa. Tente novamente.");
    }
  }

  async function remove() {
    await api(url, deletedSchema, undefined, "DELETE");
    toast.success("Conversa excluída.");
    if (current) router.push("/chat");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ações da conversa ${conversation.title}`}
              className={cn("rounded-md", className)}
            />
          }
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setDialog("rename")}>
            <Pencil aria-hidden />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void setArchived(!archived)}>
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? "Restaurar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog("delete")}
          >
            <Trash2 aria-hidden />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        open={dialog === "rename"}
        onOpenChange={(open) => setDialog(open ? "rename" : undefined)}
        title="Renomear conversa"
        label="Nome da conversa"
        value={conversation.title}
        onSave={rename}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : undefined)}
        title="Excluir esta conversa?"
        description="As mensagens serão apagadas e não podem ser recuperadas. Conversas que geraram levas não podem ser excluídas, só arquivadas."
        confirmLabel="Excluir"
        icon={Trash2}
        destructive
        onConfirm={remove}
      />
    </>
  );
}
