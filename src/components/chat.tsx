"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Mic, Square, Send, Paperclip } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { UploadArea, uploadFile } from "./upload-area";
import { publicDataSchema, opening } from "@/lib/ai/schemas";
import { api } from "@/lib/client";
export function Chat({
  conversationId,
  initialMessages,
  configured,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  configured: boolean;
}) {
  const router = useRouter();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({ api: "/api/chat", body: { conversationId } }),
    [conversationId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message),
  });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioAsset, setAudioAsset] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function voice() {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Gravação indisponível neste navegador. Envie um arquivo de áudio.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const media = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = media;
      const chunks: Blob[] = [];
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
        setRecording(false);
        setUploading(true);
        try {
          const type = media.mimeType.split(";")[0];
          const file = new File(chunks, "mensagem-audio", { type });
          setAudioAsset(await uploadFile(file, "audio"));
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Não foi possível enviar o áudio.",
          );
        } finally {
          setUploading(false);
        }
      };
      media.start();
      setRecording(true);
      timer.current = setTimeout(
        () => media.state === "recording" && media.stop(),
        120_000,
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Permita acesso ao microfone para gravar.",
      );
    }
  }
  async function newChat() {
    try {
      const c = await api("/api/conversations", z.object({ id: z.uuid() }), {});
      router.push(`/chat/${c.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar conversa.");
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Seu copywriter</h1>
        <Button variant="outline" onClick={newChat}>
          Nova conversa
        </Button>
      </div>
      {!configured && (
        <p className="rounded-md border p-3 text-sm">
          Configure as credenciais e o modelo DeepSeek no servidor para
          conversar. Seu histórico e anexos permanecem na sua conta.
        </p>
      )}
      <div aria-live="polite" className="space-y-4">
        {messages.length === 0 && (
          <Card>
            <CardContent className="pt-5">{opening}</CardContent>
          </Card>
        )}
        {messages.map((message) => (
          <Card
            key={message.id}
            className={
              message.role === "user"
                ? "ml-4 bg-muted/50 md:ml-16"
                : "mr-4 md:mr-16"
            }
          >
            <CardContent className="space-y-4 pt-5">
              <p className="text-xs font-medium text-muted-foreground">
                {message.role === "user" ? "Você" : "Copywriter"}
              </p>
              {message.parts.map((part, index) => {
                if (part.type === "text")
                  return (
                    <div
                      key={index}
                      className="space-y-3 break-words text-sm [&_p]:mb-3 [&_li]:ml-5 [&_li]:list-disc"
                    >
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  );
                if (part.type === "data-upload") {
                  const parsed = publicDataSchema.shape.upload.safeParse(
                    part.data,
                  );
                  return parsed.success ? (
                    <div key={index} className="space-y-4">
                      <p>Envie os vídeos associados aos criativos abaixo:</p>
                      {parsed.data.creativeKeys.map((key) => (
                        <UploadArea key={key} creativeKey={key} />
                      ))}
                    </div>
                  ) : null;
                }
                if (part.type === "data-batch") {
                  const parsed = publicDataSchema.shape.batch.safeParse(
                    part.data,
                  );
                  return parsed.success ? (
                    <Link
                      key={index}
                      className="block rounded-md border p-4 font-medium underline"
                      href={`/levas/${parsed.data.id}`}
                    >
                      {parsed.data.title} →
                    </Link>
                  ) : null;
                }
                return null;
              })}
            </CardContent>
          </Card>
        ))}
      </div>
      <div ref={end} />
      {audioAsset && (
        <UploadArea
          key={audioAsset}
          kind="audio"
          initialAssetId={audioAsset}
          onTranscript={(text) => {
            setInput(text);
            toast.success("Áudio transcrito. Revise o texto e envie.");
          }}
        />
      )}
      {attachments && (
        <Card>
          <CardContent className="space-y-5 pt-5">
            <UploadArea
              kind="audio"
              onTranscript={(text) => {
                if (configured && !busy) void sendMessage({ text });
                else setInput(text);
              }}
            />
            <UploadArea
              kind="video"
              onVideoReady={(id) =>
                setInput(`Analise o vídeo que enviei (asset_id: ${id}).`)
              }
            />
          </CardContent>
        </Card>
      )}
      <form
        className="sticky bottom-0 space-y-3 border-t bg-background pt-4 pb-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim() || busy) return;
          void sendMessage({ text: input });
          setInput("");
        }}
      >
        <Textarea
          aria-label="Mensagem"
          placeholder="Me conte sobre sua oferta…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={12000}
          disabled={busy}
          className="min-h-24"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAttachments((v) => !v)}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              recording ? recorder.current?.stop() : void voice()
            }
            disabled={uploading || busy}
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
          >
            {recording ? (
              <Square className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
            {recording ? "Parar" : "Áudio"}
          </Button>
          {busy ? (
            <Button type="button" onClick={() => stop()}>
              Parar resposta
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim() || !configured || recording || uploading}
            >
              <Send className="size-4" />
              Enviar
            </Button>
          )}
          {uploading && (
            <span className="text-sm text-muted-foreground">
              Enviando áudio…
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível responder. Revise o texto e tente enviar novamente.
          </p>
        )}
      </form>
    </div>
  );
}
