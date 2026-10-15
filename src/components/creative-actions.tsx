"use client";
import { useState } from "react";
import { Ellipsis, Eye, EyeOff, Trash2 } from "@/components/icons";
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
import { api, savedSchema } from "@/lib/client";

const deletedSchema = z.object({ deleted: z.boolean() });

/** Hide/show a creative in the list and delete its video. */
export function CreativeActions({
  creativeKey,
  hidden,
  hasVideo,
  onChange,
}: {
  creativeKey: string;
  hidden: boolean;
  hasVideo: boolean;
  onChange: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  async function setHidden(next: boolean) {
    try {
      await api("/api/creatives", savedSchema, { creativeKey, hidden: next }, "PATCH");
      toast.success(next ? `${creativeKey} ocultado.` : `${creativeKey} visível de novo.`);
      onChange();
    } catch {
      toast.error("Não foi possível atualizar o criativo. Tente novamente.");
    }
  }

  async function deleteVideo() {
    await api("/api/creatives/video", deletedSchema, { creativeKey }, "DELETE");
    toast.success(`Vídeo de ${creativeKey} excluído.`);
    onChange();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Mais ações de ${creativeKey}`}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => void setHidden(!hidden)}>
            {hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {hidden ? "Mostrar na lista" : "Ocultar da lista"}
          </DropdownMenuItem>
          {hasVideo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 aria-hidden />
                Excluir vídeo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Excluir o vídeo de ${creativeKey}?`}
        description="O arquivo e a análise do vídeo serão apagados e não podem ser recuperados. Os resultados do criativo continuam."
        confirmLabel="Excluir vídeo"
        icon={Trash2}
        destructive
        onConfirm={deleteVideo}
      />
    </>
  );
}
