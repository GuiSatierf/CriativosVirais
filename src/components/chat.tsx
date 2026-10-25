"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  FileSpreadsheet,
  LoaderCircle,
  Mic,
  Paperclip,
  RotateCcw,
  ShieldWarning,
  Square,
  Video,
  X,
} from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet } from "@/components/ui/sheet";
import { CsvImport } from "./csv-import";
import { SetupSheetContent } from "./integrations/shared";
import { UploadArea, uploadFile } from "./upload-area";
import { formatElapsed, useVoiceRecorder } from "./chat/use-voice-recorder";
import {
  MessageList,
  PendingAssistant,
  maxAttachedVideos,
  type ChatMessage,
} from "./chat/message-list";
import { ActionCards, WelcomeIntro } from "./chat/welcome";
import { Hint } from "./hint";
import { toastError } from "@/lib/client";
import type { Home, HomeSuggestion } from "@/lib/home";
import { looksLikeSecret, secretWarning } from "@/lib/secrets";
import { cn } from "@/lib/utils";

const videoPrompt = "Analise o vídeo que enviei.";

/** The operation spent its monthly AI budget; trying again before the month turns cannot help. */
class AiLimitError extends Error {}

// The chat transport only sees a failed response, so the budget refusal is told apart here.
async function chatFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status !== 429) return response;
  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Você usou todo o limite de IA deste mês.";
  throw new AiLimitError(message);
}

function isCsv(file: File) {
  return /\.csv$/i.test(file.name) || file.type === "text/csv";
}
/** Distance from the bottom (px) that still counts as following the reply. */
const stickThreshold = 96;

/** Whether the element is bounded and has content past its height. */
function isScrollable(element: HTMLElement) {
  return element.scrollHeight > element.clientHeight;
}

type Attachment = { id: string; name?: string };

function AttachmentChip({
  name,
  onRemove,
  children,
}: {
  name: string;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-background py-1 pr-1 pl-2.5 text-sm">
      <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="max-w-40 truncate sm:max-w-56">{name}</span>
      {children}
      <Hint label="Remover">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto rounded-lg"
          aria-label={`Remover ${name}`}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      </Hint>
    </li>
  );
}

export function Chat({
  conversationId,
  title,
  initialMessages,
  configured,
  firstName,
  home,
}: {
  conversationId: string;
  title: string;
  initialMessages: UIMessage[];
  configured: boolean;
  firstName?: string;
  /** Status and next actions shown on the hero before the first message. */
  home?: Home;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        body: { conversationId },
        fetch: chatFetch,
        // The server rebuilds the history from the database, so only the new message travels;
        // sending the whole conversation grew every request and broke long conversations.
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, conversationId, messages: messages.slice(-1) },
        }),
      }),
    [conversationId],
  );
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const { messages, sendMessage, regenerate, status, stop, error } =
    useChat<ChatMessage>({
      id: conversationId,
      messages: initialMessages as ChatMessage[],
      transport,
      onFinish: ({ isAbort, isError, isDisconnect }) => {
        setAnnouncement(
          isError || isDisconnect
            ? ""
            : isAbort
              ? "Resposta interrompida."
              : "Resposta pronta.",
        );
        // Refreshes server data such as the conversation title in the history.
        router.refresh();
      },
    });
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [attached, setAttached] = useState<Attachment[]>([]);
  const [processing, setProcessing] = useState<Attachment[]>([]);
  // Videos whose analysis failed stay listed for a retry but no longer hold the composer.
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioAsset, setAudioAsset] = useState<string>();
  const [atBottom, setAtBottom] = useState(true);
  const [secretBlocked, setSecretBlocked] = useState(false);
  const [csv, setCsv] = useState<{ file?: File; open: boolean }>({
    open: false,
  });
  const [dragging, setDragging] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const attachButton = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  // Kept while the scroller loses its bounded height (a panel route lays the page out differently).
  const distanceFromBottom = useRef(0);
  const busy = status === "submitted" || status === "streaming";
  const unavailable = !configured;
  const transcribing = audioUploading || Boolean(audioAsset);
  const empty = messages.length === 0;
  const lastMessage = messages.at(-1);
  const videoSlots = maxAttachedVideos - attached.length - processing.length;
  const analysing = processing.filter(
    (video) => !failedVideos.includes(video.id),
  );
  const canSend =
    !unavailable &&
    Boolean(input.trim()) &&
    !voice.recording &&
    !audioUploading &&
    analysing.length === 0;

  // Follows the reply only while the reader is already at the bottom.
  useEffect(() => {
    const element = scroller.current;
    if (!element || empty || !following.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, status, empty]);

  // Opening a panel lets the scroller grow to its content, which resets its position to the top;
  // when it is bounded again, the reader goes back to where they were.
  useEffect(() => {
    const element = scroller.current;
    if (element == null) return;
    const observer = new ResizeObserver(() => {
      if (isScrollable(element) === false) return;
      element.scrollTop =
        element.scrollHeight - element.clientHeight - distanceFromBottom.current;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function scrollToBottom() {
    const element = scroller.current;
    if (!element) return;
    following.current = true;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  function focusComposer() {
    requestAnimationFrame(() => {
      const field = textarea.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  function fillComposer(text: string) {
    setInput(text);
    focusComposer();
  }

  function applyTranscript(text: string) {
    setInput((current) =>
      current.trim() ? `${current.trimEnd()}\n\n${text}` : text,
    );
    setAudioAsset(undefined);
    toast.success("Áudio transcrito. Revise e envie.");
    focusComposer();
  }

  function trackVideo(id: string, name: string) {
    setPanelOpen(false);
    setProcessing((current) =>
      current.some((video) => video.id === id)
        ? current
        : [...current, { id, name }],
    );
    setInput((current) => (current.trim() ? current : videoPrompt));
    focusComposer();
  }

  function markVideoFailed(id: string, failed: boolean) {
    setFailedVideos((current) => {
      const others = current.filter((videoId) => videoId !== id);
      return failed ? [...others, id] : others;
    });
    if (!failed) {
      // A retry puts the video back on its way, so its prompt comes back too.
      setInput((current) => (current.trim() ? current : videoPrompt));
      return;
    }

    // Another video still on its way keeps the prompt filled in for it.
    const otherVideos =
      attached.length > 0 ||
      processing.some(
        (video) => video.id !== id && !failedVideos.includes(video.id),
      );
    if (otherVideos) return;

    // The prompt filled in for the upload would now be sent without its video.
    setInput((current) => (current.trim() === videoPrompt ? "" : current));
  }

  function discardVideo(id: string) {
    setProcessing((current) => current.filter((video) => video.id !== id));
    setFailedVideos((current) => current.filter((videoId) => videoId !== id));
  }

  function attachVideo(id: string, name?: string) {
    setProcessing((current) => current.filter((video) => video.id !== id));
    setAttached((current) => {
      if (current.some((video) => video.id === id)) return current;
      if (current.length >= maxAttachedVideos) {
        toast.error(
          `Anexe no máximo ${maxAttachedVideos} vídeos por mensagem.`,
        );
        return current;
      }
      return [...current, { id, name }];
    });
  }

  async function sendRecording(file: File) {
    setAudioUploading(true);
    try {
      setAudioAsset(await uploadFile(file, "audio"));
    } catch (e) {
      toastError(e, "Não foi possível enviar o áudio.");
    } finally {
      setAudioUploading(false);
    }
  }

  function submit() {
    if (!canSend || busy) return;
    const text = input.trim();
    // Keys and tokens never leave the browser through the chat.
    if (looksLikeSecret(text)) {
      setSecretBlocked(true);
      return;
    }
    const assetIds = attached.map((video) => video.id);
    following.current = true;
    setAnnouncement("Respondendo…");
    void sendMessage({
      text,
      ...(assetIds.length ? { metadata: { assetIds } } : {}),
    });
    setInput("");
    setAttached([]);
    setPanelOpen(false);
  }

  function openCsv(file?: File) {
    setPanelOpen(false);
    setCsv({ file, open: true });
  }

  async function dropFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (isCsv(file)) {
        openCsv(file);
        return;
      }
      const kind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
      if (!kind) {
        toast.error("Envie um vídeo, um áudio ou uma planilha CSV.");
        continue;
      }
      if (kind === "video" && videoSlots <= 0) {
        toast.error(`Anexe no máximo ${maxAttachedVideos} vídeos por mensagem.`);
        continue;
      }
      try {
        if (kind === "audio") {
          setAudioUploading(true);
          setAudioAsset(await uploadFile(file, "audio"));
        } else {
          toast.info(`Enviando ${file.name}…`);
          trackVideo(await uploadFile(file, "video"), file.name);
        }
      } catch (e) {
        toastError(e, "Não foi possível enviar o arquivo.");
      } finally {
        if (kind === "audio") setAudioUploading(false);
      }
    }
  }

  function pickSuggestion(suggestion: HomeSuggestion) {
    const { action } = suggestion;
    if (action.type === "link") {
      router.push(action.href);
      return;
    }
    if (action.type === "prompt") {
      if (unavailable || busy) return fillComposer(action.text);
      following.current = true;
      setAnnouncement("Respondendo…");
      void sendMessage({ text: action.text });
      return;
    }
    if (action.kind === "csv") {
      csvInput.current?.click();
      return;
    }
    setPanelOpen(true);
    setInput((current) => (current.trim() ? current : videoPrompt));
    // Moves focus into the panel so keyboard users land on the dropzone.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("#chat-attachments [role=button]")
        ?.focus(),
    );
  }

  const iconButton =
    "rounded-lg text-muted-foreground";
  const sendButton =
    "ml-auto rounded-lg";

  const composer = (
    <form
      className={cn(
        "rounded-3xl border bg-card shadow-(--shadow-panel) transition-[border-color,box-shadow] duration-(--duration-fast) has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-3 has-[textarea:focus-visible]:ring-ring/20",
        empty ? "p-3 sm:p-4" : "p-2",
      )}
      aria-busy={busy || transcribing}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {panelOpen && !unavailable && (
        <div
          id="chat-attachments"
          role="group"
          aria-label="Anexar arquivo"
          className="mb-2 grid gap-2 rounded-2xl bg-muted/50 p-2 sm:grid-cols-2"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setPanelOpen(false);
            attachButton.current?.focus();
          }}
        >
          {videoSlots > 0 ? (
            <UploadArea kind="video" dense onUploaded={trackVideo} />
          ) : (
            <p className="flex min-h-14 items-center rounded-xl border border-dashed px-3 text-sm text-muted-foreground">
              Limite de {maxAttachedVideos} vídeos por mensagem.
            </p>
          )}
          <UploadArea
            kind="audio"
            dense
            onUploaded={(id) => {
              setPanelOpen(false);
              setAudioAsset(id);
            }}
          />
          <button
            type="button"
            onClick={() => csvInput.current?.click()}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-dashed bg-card px-3 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-2"
          >
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">Importar planilha CSV</span>
              <span className="block text-xs text-muted-foreground">
                Resultados do Gerenciador de Anúncios
              </span>
            </span>
          </button>
        </div>
      )}
      {(attached.length > 0 || processing.length > 0) && (
        <ul
          aria-label="Vídeos anexados"
          className="flex flex-wrap gap-2 p-1 pb-2"
        >
          {processing.map((video) => (
            <AttachmentChip
              key={video.id}
              name={video.name ?? "Vídeo"}
              onRemove={() => discardVideo(video.id)}
            >
              <UploadArea
                kind="video"
                compact
                initialAssetId={video.id}
                onVideoReady={(id) => attachVideo(id, video.name)}
                onFailedChange={(failed) => markVideoFailed(video.id, failed)}
                onDismiss={() => discardVideo(video.id)}
              />
            </AttachmentChip>
          ))}
          {attached.map((video) => (
            <AttachmentChip
              key={video.id}
              name={video.name ?? "Vídeo anexado"}
              onRemove={() =>
                setAttached((current) =>
                  current.filter((item) => item.id !== video.id),
                )
              }
            />
          ))}
        </ul>
      )}
      {audioAsset && (
        <div className="px-2 pb-2">
          <UploadArea
            key={audioAsset}
            kind="audio"
            compact
            initialAssetId={audioAsset}
            onTranscript={applyTranscript}
            onDismiss={() => setAudioAsset(undefined)}
          />
        </div>
      )}
      {secretBlocked && (
        <div
          role="alert"
          className="mx-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warning/10 px-3 py-2 text-sm"
        >
          <ShieldWarning className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">{secretWarning}</span>
          <Link
            href="/integracoes"
            className="font-medium underline underline-offset-4"
          >
            Abrir Integrações
          </Link>
        </div>
      )}
      <label htmlFor="chat-message" className="sr-only">
        Mensagem
      </label>
      <Textarea
        id="chat-message"
        ref={textarea}
        rows={1}
        placeholder="Escreva para o Estrategista…"
        enterKeyHint="send"
        aria-describedby="chat-message-hint"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          if (secretBlocked) setSecretBlocked(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          const modifier = event.metaKey || event.ctrlKey;
          if (event.shiftKey && !modifier) return;
          // On touch keyboards Enter adds a line; the send button submits.
          if (!modifier && window.matchMedia("(pointer: coarse)").matches)
            return;
          event.preventDefault();
          submit();
        }}
        maxLength={12000}
        disabled={unavailable}
        className={cn(
          "max-h-[40svh] resize-none rounded-none border-0 bg-transparent px-2 py-1.5 text-base shadow-none hover:border-transparent focus-visible:ring-0 disabled:bg-transparent md:text-base dark:bg-transparent dark:disabled:bg-transparent",
          empty ? "min-h-18 sm:min-h-21" : "min-h-9",
        )}
      />
      <p id="chat-message-hint" className="sr-only">
        Enter envia. Shift mais Enter quebra a linha.
      </p>
      <div className="flex min-h-9 items-center gap-1.5 pt-1">
        {voice.recording ? (
          <>
            <p
              role="status"
              className="flex min-w-0 items-center gap-2 px-2 text-sm"
            >
              <span
                className="size-2 shrink-0 rounded-full bg-current text-destructive motion-safe:animate-pulse"
                aria-hidden
              />
              <span className="font-medium">Gravando</span>
              <span className="text-muted-foreground tabular-nums" aria-hidden>
                {formatElapsed(voice.elapsed)}
              </span>
              <span className="hidden text-muted-foreground sm:inline">
                · máx. 2 min
              </span>
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-lg"
              onClick={() => voice.stop()}
            >
              <Square className="fill-current" aria-hidden />
              Parar
            </Button>
          </>
        ) : audioUploading ? (
          <p
            role="status"
            className="flex items-center gap-2 px-2 text-sm text-muted-foreground"
          >
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Enviando áudio…
          </p>
        ) : (
          <>
            <Hint label="Anexar vídeo ou áudio">
              <Button
                ref={attachButton}
                type="button"
                variant="ghost"
                size="icon"
                className={iconButton}
                aria-label="Anexar vídeo ou áudio"
                onClick={() => setPanelOpen((open) => !open)}
                disabled={unavailable}
                aria-expanded={panelOpen}
                aria-controls={panelOpen ? "chat-attachments" : undefined}
              >
                <Paperclip aria-hidden />
              </Button>
            </Hint>
            <Hint label="Gravar áudio">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={iconButton}
                aria-label="Gravar áudio"
                onClick={() => void voice.start(sendRecording)}
                disabled={unavailable || transcribing}
              >
                <Mic aria-hidden />
              </Button>
            </Hint>
            {unavailable && (
              <p className="min-w-0 px-1 text-xs leading-snug text-pretty text-muted-foreground">
                O Estrategista ainda não foi configurado nesta instalação.
              </p>
            )}
          </>
        )}
        {busy ? (
          <Hint label="Parar resposta">
            <Button
              type="button"
              size="icon"
              className={sendButton}
              aria-label="Parar resposta"
              onClick={() => stop()}
            >
              <Square className="size-3.5 fill-current" aria-hidden />
            </Button>
          </Hint>
        ) : (
          <Hint
            label={
              analysing.length
                ? "Aguarde a análise do vídeo"
                : "Enviar mensagem"
            }
          >
            <Button
              type="submit"
              size="icon"
              className={sendButton}
              aria-label="Enviar mensagem"
              disabled={!canSend}
            >
              <ArrowUp aria-hidden />
            </Button>
          </Hint>
        )}
      </div>
    </form>
  );

  const errorAlert = error instanceof AiLimitError && !busy ? (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>Limite de IA do mês atingido.</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ) : error && !busy && (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>Não foi possível gerar a resposta.</AlertTitle>
      <AlertDescription>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            following.current = true;
            setAnnouncement("Respondendo…");
            void regenerate();
          }}
        >
          <RotateCcw aria-hidden />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );

  return (
    // Fills <main>, a padding-free flex column on chat routes; the shell's top
    // bar holds new conversation, history and the account menu.
    // The composer keeps one tree position in both states so it never
    // remounts (and loses focus) when the first message is sent.
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!unavailable && event.dataTransfer.types.includes("Files"))
          setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        if (!unavailable) void dropFiles(event.dataTransfer.files);
      }}
    >
      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-ring bg-background/80 text-base font-medium backdrop-blur-sm"
        >
          Solte o vídeo, áudio ou planilha CSV
        </div>
      )}
      <input
        ref={csvInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openCsv(file);
        }}
      />
      <Sheet
        open={csv.open}
        onOpenChange={(open) => setCsv((current) => ({ ...current, open }))}
      >
        {csv.open && (
          <SetupSheetContent
            title="Importar planilha"
            description="Uma linha por criativo. Só o código do criativo é obrigatório."
          >
            <CsvImport
              initialFile={csv.file}
              onImported={() => {
                setCsv({ open: false });
                router.refresh();
              }}
            />
          </SetupSheetContent>
        )}
      </Sheet>
      <h1 className="sr-only">{title || "Conversa"}</h1>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          empty &&
            "overflow-y-auto overscroll-contain px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6",
        )}
      >
        <div
          ref={scroller}
          onScroll={(event) => {
            const element = event.currentTarget;
            if (isScrollable(element) === false) return;
            const distance =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            distanceFromBottom.current = distance;
            const near = distance < stickThreshold;
            following.current = near;
            setAtBottom(near);
          }}
          className={
            empty
              ? "mt-auto shrink-0"
              : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6"
          }
        >
          {empty ? (
            <div className="mx-auto w-full max-w-2xl space-y-4 pb-5 sm:pb-8">
              <WelcomeIntro
                firstName={firstName}
                status={home?.status}
                firstContact={home?.firstContact}
              />
              {errorAlert}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-8 pt-6 pb-6 lg:pt-10">
              <MessageList
                messages={messages}
                streaming={status === "streaming"}
              />
              {status === "submitted" && lastMessage?.role !== "assistant" && (
                <PendingAssistant />
              )}
              {errorAlert}
            </div>
          )}
        </div>
        <div
          className={cn(
            "shrink-0",
            !empty &&
              "px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-5",
          )}
        >
          <div
            className={cn(
              "relative mx-auto w-full",
              empty ? "max-w-2xl" : "max-w-3xl",
            )}
          >
            {!empty && !atBottom && (
              <Hint label="Ir para a última mensagem">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-lg bg-card shadow-(--shadow-floating)"
                  aria-label="Ir para a última mensagem"
                  onClick={scrollToBottom}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </Hint>
            )}
            {composer}
          </div>
        </div>
        {empty && (
          <div className="mx-auto mb-auto w-full max-w-2xl shrink-0 pt-3 pb-[6svh] sm:pt-4">
            <ActionCards
              suggestions={home?.suggestions ?? []}
              disabled={unavailable}
              onPick={pickSuggestion}
            />
          </div>
        )}
      </div>
    </div>
  );
}
