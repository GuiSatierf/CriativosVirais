"use client";
import { useState, useEffect, useEffectEvent, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { toast } from "sonner";
import {
  FileAudio,
  Video,
  Upload,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RotateCw,
  X,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, savedSchema, toastError } from "@/lib/client";

const assetSchema = z.object({
  id: z.uuid(),
  status: z.enum(["uploaded", "processing", "done", "error"]),
  kind: z.enum(["audio", "video"]),
  error: z.string().nullable(),
  transcription: z.object({ text: z.string() }).nullable(),
});

const uploadFailed =
  "Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.";
/** Consecutive status-check failures tolerated before polling stops. */
const maxPollFailures = 3;
const pollInterval = 5000;

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
  }).catch(() => null);
  if (!response?.ok) throw new Error(uploadFailed);
  await api(
    "/api/uploads/complete",
    z.object({ assetId: z.uuid(), status: z.string() }),
    { assetId: upload.assetId },
  );
  return upload.assetId;
}

type Phase =
  | "idle"
  | "uploading"
  | "waiting"
  | "processing"
  | "done"
  | "failed"
  | "unreachable";

function phaseText(
  phase: Phase,
  kind: "video" | "audio",
  failure: string | null,
) {
  const audio = kind === "audio";
  switch (phase) {
    case "idle":
      return "";
    case "uploading":
      return audio ? "Enviando áudio…" : "Enviando vídeo…";
    case "waiting":
    case "processing":
      return audio ? "Transcrevendo áudio…" : "Analisando vídeo…";
    case "done":
      return audio ? "Áudio transcrito." : "Análise concluída.";
    case "failed":
      return (
        failure ||
        (audio
          ? "Não foi possível transcrever o áudio."
          : "Não foi possível analisar o vídeo.")
      );
    case "unreachable":
      return "Não foi possível verificar o andamento do arquivo.";
  }
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === "failed" || phase === "unreachable")
    return <CircleAlert className="size-4 shrink-0" aria-hidden />;
  if (phase === "done")
    return (
      <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
    );
  if (phase === "idle") return null;
  return (
    <LoaderCircle
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  );
}

/**
 * Uploads a video or audio file and follows its processing. In `compact` mode
 * there is no dropzone: it only tracks `initialAssetId` with a status row.
 * `dense` renders a single-row dropzone. With `onUploaded` the parent takes
 * over processing once the bytes are stored, and the dropzone resets.
 */
export function UploadArea({
  creativeKey,
  kind = "video",
  onTranscript,
  initialAssetId,
  onVideoReady,
  compact = false,
  onDismiss,
  onFailedChange,
  dense = false,
  onUploaded,
}: {
  creativeKey?: string;
  kind?: "video" | "audio";
  onTranscript?: (text: string) => void;
  initialAssetId?: string;
  onVideoReady?: (assetId: string, fileName?: string) => void;
  compact?: boolean;
  /** Compact mode only: lets the user discard a failed asset. */
  onDismiss?: () => void;
  /** Reports when processing fails (true) and when a retry starts again (false). */
  onFailedChange?: (failed: boolean) => void;
  dense?: boolean;
  onUploaded?: (assetId: string, fileName: string) => void;
}) {
  const [assetId, setAssetId] = useState(initialAssetId);
  const [fileName, setFileName] = useState<string>();
  const [phase, setPhase] = useState<Phase>(
    initialAssetId ? "waiting" : "idle",
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const delivered = useRef<string | null>(null);

  const deliver = useEffectEvent((asset: z.infer<typeof assetSchema>) => {
    if (delivered.current === asset.id) return;
    if (asset.kind === "video") {
      delivered.current = asset.id;
      onVideoReady?.(asset.id, fileName);
    } else if (asset.transcription) {
      delivered.current = asset.id;
      onTranscript?.(asset.transcription.text);
    }
  });

  const reportFailure = useEffectEvent(() => onFailedChange?.(true));

  useEffect(() => {
    if (!assetId) return;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const asset = await api(`/api/assets/${assetId}`, assetSchema);
        if (stopped) return;
        failures = 0;
        if (asset.status === "error") {
          setFailure(asset.error);
          setPhase("failed");
          reportFailure();
          return;
        }
        if (asset.status === "done") {
          setPhase("done");
          deliver(asset);
          return;
        }
        setPhase(asset.status === "processing" ? "processing" : "waiting");
      } catch {
        if (stopped) return;
        failures += 1;
        if (failures >= maxPollFailures) {
          setPhase("unreachable");
          reportFailure();
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, pollInterval);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [assetId, attempt]);

  async function receive(files: File[]) {
    const file = files[0];
    if (!file) return;
    setPhase("uploading");
    setFailure(null);
    try {
      const id = await uploadFile(file, kind, creativeKey);
      if (onUploaded) {
        setPhase("idle");
        onUploaded(id, file.name);
        return;
      }
      setFileName(file.name);
      setAssetId(id);
      setPhase("waiting");
    } catch (e) {
      toastError(e, uploadFailed);
      setPhase("idle");
    }
  }

  async function retry() {
    if (!assetId) return;
    if (phase === "failed") {
      try {
        await api(`/api/assets/${assetId}/retry`, savedSchema, {});
      } catch (e) {
        toastError(e, "Não foi possível tentar novamente.");
        return;
      }
    }
    setFailure(null);
    setPhase("waiting");
    setAttempt((value) => value + 1);
    onFailedChange?.(false);
  }

  const uploading = phase === "uploading";
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDropAccepted: receive,
      onDropRejected: () =>
        toast.error("Formato inválido ou arquivo acima do limite."),
      multiple: false,
      disabled: uploading || compact,
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

  const problem = phase === "failed" || phase === "unreachable";
  const text = phaseText(phase, kind, failure);
  const noun = kind === "video" ? "vídeo" : "áudio";

  const statusRow = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p
        role="status"
        className={cn(
          "flex min-h-6 items-center gap-2 text-sm leading-relaxed",
          problem ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <PhaseIcon phase={phase} />
        {text}
      </p>
      {problem && assetId && (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={retry}
        >
          <RotateCw aria-hidden />
          Tentar novamente
        </Button>
      )}
      {/* A transcription can be dropped while it runs, so a bad take never fills the composer. */}
      {(phase === "waiting" || phase === "processing") && compact && onDismiss && (
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          <X aria-hidden />
          Cancelar
        </Button>
      )}
      {problem && compact && onDismiss && (
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          <X aria-hidden />
          Descartar
        </Button>
      )}
    </div>
  );

  if (compact) return statusRow;

  const formats =
    kind === "video"
      ? "MP4, MOV ou WEBM até 250 MB"
      : "MP3, M4A, OGG, WAV ou WEBM até 25 MB";
  const Icon = uploading ? Upload : kind === "video" ? Video : FileAudio;
  const label = uploading ? "Enviando…" : `Escolha ou arraste um ${noun}`;

  if (dense)
    return (
      <div className="space-y-2">
        {creativeKey && <p className="text-sm font-medium">{creativeKey}</p>}
        <div
          {...getRootProps({ role: "button" })}
          aria-disabled={uploading}
          aria-busy={uploading}
          className={cn(
            "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input px-3 py-2.5 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
            isDragActive && "border-ring bg-muted",
            isDragReject && "border-destructive bg-destructive/5",
            uploading && "cursor-wait opacity-60",
          )}
        >
          <input
            {...getInputProps()}
            aria-label={`Arquivo de ${noun}${creativeKey ? ` para ${creativeKey}` : ""}`}
          />
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">
              {label}
              {creativeKey && (
                <span className="sr-only"> para {creativeKey}</span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formats}
            </span>
          </span>
        </div>
        {phase !== "idle" && statusRow}
      </div>
    );

  return (
    <div className="space-y-2">
      {creativeKey && <p className="font-medium">{creativeKey}</p>}
      <div
        {...getRootProps({ role: "button" })}
        aria-disabled={uploading}
        aria-busy={uploading}
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-muted/30 p-6 text-center text-sm outline-none transition-colors duration-(--duration-normal) hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
          isDragActive && "border-ring bg-muted",
          isDragReject && "border-destructive bg-destructive/5",
          uploading && "cursor-wait opacity-60",
        )}
      >
        <input
          {...getInputProps()}
          aria-label={`Arquivo de ${noun}${creativeKey ? ` para ${creativeKey}` : ""}`}
        />
        {uploading ? (
          <Upload className="size-6 text-muted-foreground" aria-hidden />
        ) : kind === "video" ? (
          <Video
            className="size-6 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
        ) : (
          <FileAudio
            className="size-6 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        <span className="font-medium">
          {uploading ? "Enviando…" : `Escolha ou arraste um ${noun}`}
          {creativeKey && <span className="sr-only"> para {creativeKey}</span>}
        </span>
        <span className="text-muted-foreground">
          {kind === "video"
            ? "MP4, MOV ou WEBM até 250 MB"
            : "MP3, M4A, OGG, WAV ou WEBM até 25 MB"}
        </span>
      </div>
      {statusRow}
    </div>
  );
}
