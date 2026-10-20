"use client";
import { memo, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ChartColumn,
  Check,
  CircleAlert,
  Copy,
  Layers,
  Loader2,
  Plug,
  Storefront,
  UserRound,
  Video,
  type AppIcon,
} from "@/components/icons";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { UploadArea } from "@/components/upload-area";
import { publicDataSchema } from "@/lib/ai/schemas";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { StrategistAvatar, strategistName } from "./strategist";

export const maxAttachedVideos = 5;
export const messageMetadataSchema = z.object({
  assetIds: z.array(z.uuid()).max(maxAttachedVideos).optional(),
});
export type ChatMessage = UIMessage<z.infer<typeof messageMetadataSchema>>;

// Older messages embedded the asset reference in the text itself.
const legacyAssetPattern =
  /\s*\(asset_id:\s*[0-9a-f-]{36}\)|\s*asset_id:\s*[0-9a-f-]{36}/gi;

function videoCount(message: ChatMessage) {
  const metadata = messageMetadataSchema.safeParse(message.metadata);
  if (metadata.success && metadata.data.assetIds?.length)
    return metadata.data.assetIds.length;
  return message.parts.some(
    (part) => part.type === "text" && /asset_id:/i.test(part.text),
  )
    ? 1
    : 0;
}

function messageText(message: ChatMessage) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n")
    .trim();
}

function AssistantLabel({ status }: { status?: string }) {
  return (
    <h3 className="flex h-8 items-center gap-2 text-sm font-semibold">
      {strategistName}
      {status && (
        <span className="text-xs font-normal text-muted-foreground">
          {status}
        </span>
      )}
    </h3>
  );
}

/** Assistant turns sit beside the strategist's avatar, like a chat with a person. */
function AssistantRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <StrategistAvatar className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  );
}

/** Three subtle dots while the assistant prepares its answer. */
export function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1" aria-hidden>
      {["", "[animation-delay:160ms]", "[animation-delay:320ms]"].map(
        (delay) => (
          <span
            key={delay}
            className={cn(
              "size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-pulse",
              delay,
            )}
          />
        ),
      )}
    </span>
  );
}

export function PendingAssistant() {
  return (
    <AssistantRow>
      <AssistantLabel status="pensando…" />
      <TypingDots />
    </AssistantRow>
  );
}

function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <>
      <Hint label={copied ? "Copiado" : "Copiar resposta"}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copiar resposta"
          className="rounded-lg text-muted-foreground"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              toast.error(
                "O navegador não permitiu copiar. Copie manualmente.",
              );
            }
          }}
        >
          <Icon aria-hidden />
        </Button>
      </Hint>
      <span role="status" className="sr-only">
        {copied ? "Resposta copiada." : ""}
      </span>
    </>
  );
}

function BatchCard({ id, title }: { id: string; title: string }) {
  return (
    <Link
      href={`/levas/${id}`}
      className="group/card flex items-center gap-3 rounded-xl border bg-card p-3 outline-none transition-[background-color,transform] duration-(--duration-fast) hover:bg-muted/60 active:scale-[0.99] active:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Layers className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">
          Abrir leva de roteiros
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover/card:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

const generationStatusSchema = z.object({
  status: z.enum(["queued", "running", "done", "failed"]),
  title: z.string(),
  batchId: z.uuid().nullable(),
  error: z.string().nullable(),
});
type GenerationStatus = z.infer<typeof generationStatusSchema>;
const generationPollMs = 3_000;
// Same tolerance as the upload card: a lasting error (the generation was deleted) ends the polling.
const maxGenerationPollFailures = 3;

/** Follows a batch the worker is generating until it is done or failed. */
function useGenerationStatus(id: string, title: string) {
  const [state, setState] = useState<GenerationStatus | null>(null);
  useEffect(() => {
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const next = await api(`/api/batch-generations/${id}`, generationStatusSchema);
        if (stopped) return;
        failures = 0;
        setState(next);
        if (next.status === "done" || next.status === "failed") return;
      } catch {
        // A network blip is retried on the next poll; the card keeps showing "Gerando".
        failures += 1;
        if (failures >= maxGenerationPollFailures) {
          if (!stopped) setState({ status: "failed", title, batchId: null, error: null });
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, generationPollMs);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, title]);
  return state;
}

/** Same look as BatchCard, without a link, for a batch that is not ready. */
function BatchStatusCard({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </div>
  );
}

function GenerationCard({ id, title }: { id: string; title: string }) {
  const state = useGenerationStatus(id, title);
  if (state?.status === "done" && state.batchId)
    return <BatchCard id={state.batchId} title={state.title} />;
  if (state?.status === "failed")
    return (
      <BatchStatusCard
        icon={<CircleAlert className="size-4 text-destructive" aria-hidden />}
        title={state.title}
        note={state.error ?? "Não foi possível gerar. Peça de novo."}
      />
    );
  return (
    <BatchStatusCard
      icon={<Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
      title={`Gerando a ${title}`}
      note="Pode continuar conversando. A leva aparece aqui quando ficar pronta."
    />
  );
}

const panels: Record<
  z.infer<typeof publicDataSchema.shape.panel>["panel"],
  { href: string; title: string; description: string; icon: AppIcon }
> = {
  levas: { href: "/levas", title: "Suas levas", description: "Roteiros que você já gerou", icon: Layers },
  resultados: { href: "/criativos", title: "Resultados", description: "Métricas de cada criativo", icon: ChartColumn },
  integracoes: { href: "/integracoes", title: "Integrações", description: "Planilha, UTMify e webhook", icon: Plug },
  oferta: { href: "/configuracoes", title: "Minha oferta", description: "O que o Estrategista sabe do seu negócio", icon: Storefront },
  perfil: { href: "/perfil", title: "Perfil", description: "Foto, nome e senha", icon: UserRound },
};

const contextLabels: Record<string, string> = {
  produtoNome: "nome do produto",
  produto: "produto",
  publico: "público",
  transformacao: "transformação",
  mecanismo: "mecanismo",
  ticketCents: "ticket",
  tipoFunil: "funil",
  proximoPassoFunil: "próximo passo",
  provasAutorizadas: "provas",
  objecoes: "objeções",
  restricoes: "restrições",
  estadoCliente: "momento atual",
  especialistaHandle: "especialista",
  notas: "observações",
};

/** Link card that opens a panel over the conversation. */
function PanelCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: AppIcon;
}) {
  return (
    <Link
      href={href}
      className="group/card flex items-center gap-3 rounded-xl border bg-card p-3 outline-none transition-[background-color,transform] duration-(--duration-fast) hover:bg-accent/60 active:scale-[0.99] active:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover/card:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

// Memoized: a message re-renders only when it changes, not on every keystroke or streamed chunk.
const UserMessage = memo(function UserMessage({ message }: { message: ChatMessage }) {
  const videos = videoCount(message);
  const text = messageText(message).replace(legacyAssetPattern, "").trim();
  return (
    <div className="flex justify-end">
      <h3 className="sr-only">Você</h3>
      <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-md bg-secondary px-4 py-2.5">
        {videos > 0 && (
          <span className="flex w-fit items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">
            <Video className="size-3.5" aria-hidden />
            {videos === 1 ? "Vídeo anexado" : `${videos} vídeos anexados`}
          </span>
        )}
        {text && (
          <p className="text-base whitespace-pre-wrap [overflow-wrap:anywhere]">
            {text}
          </p>
        )}
      </div>
    </div>
  );
});

const AssistantMessage = memo(function AssistantMessage({
  message,
  streaming,
  last,
}: {
  message: ChatMessage;
  streaming: boolean;
  last: boolean;
}) {
  const text = messageText(message);
  return (
    <AssistantRow className="group/message">
      <AssistantLabel status={streaming ? "escrevendo…" : undefined} />
      {streaming && !text && <TypingDots />}
      {message.parts.map((part, index) => {
        if (part.type === "text")
          return (
            <div key={index} className="reading-copy text-base">
              <ReactMarkdown>{part.text}</ReactMarkdown>
            </div>
          );
        if (part.type === "data-upload") {
          const parsed = publicDataSchema.shape.upload.safeParse(part.data);
          return parsed.success ? (
            <div key={index} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envie os vídeos destes criativos:
              </p>
              {parsed.data.creativeKeys.map((key) => (
                <UploadArea key={key} creativeKey={key} dense />
              ))}
            </div>
          ) : null;
        }
        if (part.type === "data-panel") {
          const parsed = publicDataSchema.shape.panel.safeParse(part.data);
          return parsed.success ? (
            <PanelCard key={index} {...panels[parsed.data.panel]} />
          ) : null;
        }
        if (part.type === "data-context") {
          const parsed = publicDataSchema.shape.context.safeParse(part.data);
          if (!parsed.success) return null;
          const names = parsed.data.fields.flatMap((f) =>
            contextLabels[f] ? [contextLabels[f]] : [],
          );
          return (
            <PanelCard
              key={index}
              href="/configuracoes"
              title="Anotei na sua oferta"
              description={
                names.length
                  ? `${names.join(", ").replace(/^./, (c) => c.toUpperCase())} · revisar`
                  : "Revisar o que foi salvo"
              }
              icon={Storefront}
            />
          );
        }
        if (part.type === "data-generation") {
          const parsed = publicDataSchema.shape.generation.safeParse(part.data);
          return parsed.success ? (
            <GenerationCard key={index} id={parsed.data.id} title={parsed.data.title} />
          ) : null;
        }
        if (part.type === "data-batch") {
          const parsed = publicDataSchema.shape.batch.safeParse(part.data);
          return parsed.success ? (
            <BatchCard
              key={index}
              id={parsed.data.id}
              title={parsed.data.title}
            />
          ) : null;
        }
        return null;
      })}
      {text && !streaming && (
        <div
          className={cn(
            "-ml-2 flex items-center gap-1 transition-opacity duration-(--duration-fast) focus-within:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100",
            last ? "opacity-100" : "opacity-0",
          )}
        >
          <CopyMessage text={text} />
        </div>
      )}
    </AssistantRow>
  );
});

export const MessageList = memo(function MessageList({
  messages,
  streaming,
}: {
  messages: ChatMessage[];
  streaming: boolean;
}) {
  return (
    <section aria-label="Mensagens da conversa" className="space-y-6">
      {messages.map((message, index) => {
        const last = index === messages.length - 1;
        return message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage
            key={message.id}
            message={message}
            last={last}
            streaming={last && streaming}
          />
        );
      })}
    </section>
  );
});
