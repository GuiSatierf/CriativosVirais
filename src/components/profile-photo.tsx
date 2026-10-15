"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, LoaderCircle, Trash2 } from "@/components/icons";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api, savedSchema, toastError } from "@/lib/client";

const side = 512;
const unreadable = "Não foi possível ler essa imagem. Tente uma foto em JPG ou PNG.";
const errorSchema = z.object({ error: z.string() });

/** Center-crops to a square and scales down so any phone photo fits the limit. */
async function squarePhoto(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(unreadable);
  const crop = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, crop);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(unreadable);
  context.drawImage(
    bitmap,
    (bitmap.width - crop) / 2,
    (bitmap.height - crop) / 2,
    crop,
    crop,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob) throw new Error(unreadable);
  return blob;
}

export function ProfilePhoto({
  name,
  image,
}: {
  name: string;
  image?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove">();
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  async function upload(file: File) {
    setBusy("upload");
    try {
      const body = await squarePhoto(file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": body.type },
        body,
      });
      if (!response.ok) {
        const data = errorSchema.safeParse(
          await response.json().catch(() => null),
        );
        throw new Error(data.success ? data.data.error : undefined);
      }
      toast.success("Foto atualizada.");
      router.refresh();
    } catch (error) {
      toastError(error, "Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setBusy(undefined);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await api("/api/profile/avatar", savedSchema, undefined, "DELETE");
      toast.success("Foto removida.");
      router.refresh();
    } catch (error) {
      toastError(error, "Não foi possível remover a foto.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar className="size-16 sm:size-20">
        {image && <AvatarImage src={image} alt="Sua foto de perfil" />}
        <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">
          JPG, PNG ou WEBP. A foto é cortada em formato quadrado.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(busy)}
            aria-busy={busy === "upload"}
            onClick={() => input.current?.click()}
          >
            {busy === "upload" ? (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <Camera aria-hidden />
            )}
            {busy === "upload"
              ? "Enviando…"
              : image
                ? "Trocar foto"
                : "Enviar foto"}
          </Button>
          {image && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={Boolean(busy)}
              aria-busy={busy === "remove"}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
