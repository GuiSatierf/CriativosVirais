"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Folder,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RenameDialog } from "@/components/rename-dialog";
import { api, savedSchema, toastError } from "@/lib/client";
import { cn } from "@/lib/utils";

const deletedSchema = z.object({ deleted: z.boolean() });

type Project = { id: string; name: string };

/** Rename, move to a project, archive/restore and delete for one conversation. */
export function ConversationActions({
  conversation,
  archived = false,
  projects = [],
  className,
}: {
  conversation: { id: string; title: string; projectId?: string | null };
  archived?: boolean;
  /** Projects it can move to; without any, the menu has no "Mover para projeto". */
  projects?: Project[];
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

  async function moveTo(project: Project | null) {
    try {
      await api(url, savedSchema, { projectId: project?.id ?? null }, "PATCH");
      toast.success(project == null ? "Conversa tirada do projeto." : `Conversa movida para ${project.name}.`);
      router.refresh();
    } catch (error) {
      toastError(error, "Não foi possível mover a conversa. Tente novamente.");
    }
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
          {projects.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Folder aria-hidden />
                Mover para projeto
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    disabled={project.id === conversation.projectId}
                    onClick={() => void moveTo(project)}
                  >
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuItem>
                ))}
                {conversation.projectId != null && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void moveTo(null)}>Tirar do projeto</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
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
