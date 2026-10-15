"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/client";

export const recordingLimitSeconds = 120;

/** Records microphone audio up to the limit and hands the file to `onFile`. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
      const media = recorder.current;
      if (media) {
        media.onstop = null;
        if (media.state === "recording") media.stop();
        media.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  async function start(onFile: (file: File) => void) {
    let activeStream: MediaStream | undefined;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Gravação indisponível neste navegador. Envie um arquivo de áudio.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream = stream;
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
      let failed = false;
      media.onerror = () => {
        failed = true;
        stream.getTracks().forEach((track) => track.stop());
        clearTicker();
        setRecording(false);
        toast.error(
          "A gravação falhou. Tente novamente ou envie um arquivo de áudio.",
        );
      };
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        clearTicker();
        setRecording(false);
        if (failed || !chunks.length) return;
        const type = media.mimeType.split(";")[0];
        onFile(new File(chunks, "mensagem-audio", { type }));
      };
      const startedAt = Date.now();
      media.start();
      setElapsed(0);
      setRecording(true);
      ticker.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(Math.min(seconds, recordingLimitSeconds));
        if (seconds >= recordingLimitSeconds && media.state === "recording") {
          media.stop();
          toast.info(
            "A gravação chegou ao limite de 2 minutos e foi encerrada.",
          );
        }
      }, 250);
    } catch (e) {
      activeStream?.getTracks().forEach((track) => track.stop());
      clearTicker();
      setRecording(false);
      // Browser permission errors are English DOMExceptions; show our own copy.
      toastError(
        e instanceof DOMException ? null : e,
        "Permita acesso ao microfone para gravar.",
      );
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return { recording, elapsed, start, stop };
}

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
