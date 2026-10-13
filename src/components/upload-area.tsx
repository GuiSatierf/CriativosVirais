"use client";
import { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, savedSchema } from "@/lib/client";
const assetSchema = z.object({
  id: z.uuid(),
  status: z.enum(["uploaded", "processing", "done", "error"]),
  kind: z.enum(["audio", "video"]),
  error: z.string().nullable(),
  transcription: z.object({ text: z.string() }).nullable(),
});
export async function uploadFile(
  file: File,
  kind: "video" | "audio",
  creativeKey?: string,
) {
  const mime = file.type.split(";")[0];
  const upload = await api(
    "/api/uploads/presign",
    z.object({ url: z.url(), assetId: z.uuid() }),
    { mime, size: file.size, kind, ...(creativeKey ? { creativeKey } : {}) },
  );
  // File bytes travel directly to object storage; the Next server only receives metadata.
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: file,
  });
  if (!response.ok)
    throw new Error(
      "Falha no upload. Confira o endpoint público e CORS do storage.",
    );
  await api(
    "/api/uploads/complete",
    z.object({ assetId: z.uuid(), status: z.string() }),
    { assetId: upload.assetId },
  );
  return upload.assetId;
}
export function UploadArea({
  creativeKey,
  kind = "video",
  onTranscript,
  initialAssetId,
  onVideoReady,
}: {
  creativeKey?: string;
  kind?: "video" | "audio";
  onTranscript?: (text: string) => void;
  initialAssetId?: string;
  onVideoReady?: (assetId: string) => void;
}) {
  const [assetId, setAssetId] = useState(initialAssetId);
  const [status, setStatus] = useState("Envie um arquivo");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const delivered = useRef<string | null>(null);
  const videoCallback = useRef(onVideoReady);
  useEffect(() => {
    videoCallback.current = onVideoReady;
  }, [onVideoReady]);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    if (!assetId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const asset = await api(`/api/assets/${assetId}`, assetSchema);
        if (stopped) return;
        setError(asset.status === "error");
        setStatus(
          asset.status === "done"
            ? "Análise concluída"
            : asset.status === "error"
              ? asset.error || "Falha na análise"
              : asset.status === "processing"
                ? "Processando…"
                : "Aguardando o worker…",
        );
        if (asset.status === "done") {
          if (asset.kind === "video" && delivered.current !== asset.id) {
            delivered.current = asset.id;
            videoCallback.current?.(asset.id);
          }
          if (
            asset.kind === "audio" &&
            asset.transcription &&
            delivered.current !== asset.id
          ) {
            delivered.current = asset.id;
            callback.current?.(asset.transcription.text);
          }
          return;
        }
      } catch (e) {
        if (!stopped)
          setStatus(
            e instanceof Error ? e.message : "Falha ao consultar arquivo.",
          );
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [assetId]);
  async function receive(files: File[]) {
    if (!files[0]) return;
    setPending(true);
    try {
      setStatus("Enviando…");
      setAssetId(await uploadFile(files[0], kind, creativeKey));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
      setStatus("Não foi possível enviar.");
    } finally {
      setPending(false);
    }
  }
  const { getRootProps, getInputProps } = useDropzone({
    onDropAccepted: receive,
    onDropRejected: () =>
      toast.error("Formato inválido ou arquivo acima do limite."),
    multiple: false,
    disabled: pending,
    maxSize: kind === "video" ? 250_000_000 : 25_000_000,
    accept:
      kind === "video"
        ? {
            "video/mp4": [".mp4"],
            "video/webm": [".webm"],
            "video/quicktime": [".mov"],
          }
        : {
            "audio/mpeg": [".mp3"],
            "audio/webm": [".webm"],
            "audio/ogg": [".ogg"],
            "audio/mp4": [".m4a"],
            "audio/wav": [".wav"],
          },
  });
  return (
    <div className="space-y-2">
      {creativeKey && <p className="font-medium">{creativeKey}</p>}
      <div
        {...getRootProps()}
        className="cursor-pointer rounded-md border border-dashed p-4 text-sm hover:bg-muted"
      >
        <input
          {...getInputProps()}
          aria-label={`Enviar ${kind === "video" ? "vídeo" : "áudio"} ${creativeKey ?? ""}`}
        />
        <p>
          {pending
            ? "Enviando…"
            : `Clique ou arraste um ${kind === "video" ? "vídeo (até 250 MB)" : "áudio (até 25 MB)"}`}
        </p>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      {error && assetId && (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await api(`/api/assets/${assetId}/retry`, savedSchema, {});
              setError(false);
              setStatus("Nova tentativa enfileirada.");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Falha ao reenfileirar.",
              );
            }
          }}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
