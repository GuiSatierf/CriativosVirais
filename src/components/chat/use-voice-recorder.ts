"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/client";

export const recordingLimitSeconds = 120;

/** How often the recording clock ticks, in ms. */
const tickMs = 250;
/** Browser storage key for the chosen microphone; remembered per browser only. */
const microphoneKey = "criativos-virais:microfone";

export type Microphone = { id: string; label: string };

/** Root-mean-square loudness of the analyser's current waveform, from 0 to about 1. */
export function readLoudness(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(samples);
  const energy = samples.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(energy / samples.length);
}

function readStoredMicrophone() {
  try {
    return localStorage.getItem(microphoneKey) ?? "";
  } catch {
    return "";
  }
}

function storeMicrophone(id: string) {
  try {
    if (id === "") localStorage.removeItem(microphoneKey);
    else localStorage.setItem(microphoneKey, id);
  } catch {
    // Private windows can refuse storage; the choice then lasts for this page only.
  }
}

async function openMicrophone(id: string) {
  if (id === "") return navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } } });
  } catch {
    // The chosen microphone was unplugged or renamed: fall back to the system default.
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

/**
 * Records microphone audio up to the limit and hands the file to `onFile`. While recording it
 * exposes an analyser for a live level meter.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [microphones, setMicrophones] = useState<Microphone[]>([]);
  // Read on first render; on the server storage is missing and this falls back to the default.
  const [microphoneId, setMicrophoneId] = useState(readStoredMicrophone);
  const recorder = useRef<MediaRecorder | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  function clearTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }

  function closeMeter() {
    void audio.current?.close();
    audio.current = null;
    setAnalyser(null);
  }

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
      void audio.current?.close();
      const media = recorder.current;
      if (media) {
        media.onstop = null;
        if (media.state === "recording") media.stop();
        media.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  /** Lists the audio inputs; names only appear once the browser has microphone permission. */
  async function listMicrophones() {
    if (navigator.mediaDevices?.enumerateDevices == null) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "");
    setMicrophones(
      inputs.map((device, index) => ({
        id: device.deviceId,
        label: device.label === "" ? `Microfone ${index + 1}` : device.label,
      })),
    );
  }

  function chooseMicrophone(id: string) {
    setMicrophoneId(id);
    storeMicrophone(id);
  }

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
      const stream = await openMicrophone(microphoneId);
      activeStream = stream;
      void listMicrophones();
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

      const context = new AudioContext();
      audio.current = context;
      const meter = context.createAnalyser();
      meter.fftSize = 512;
      context.createMediaStreamSource(stream).connect(meter);
      setAnalyser(meter);

      const chunks: Blob[] = [];
      let failed = false;
      media.onerror = () => {
        failed = true;
        stream.getTracks().forEach((track) => track.stop());
        clearTicker();
        closeMeter();
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
        closeMeter();
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
      }, tickMs);
    } catch (e) {
      activeStream?.getTracks().forEach((track) => track.stop());
      clearTicker();
      closeMeter();
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

  return {
    recording,
    elapsed,
    analyser,
    microphones,
    microphoneId,
    listMicrophones,
    chooseMicrophone,
    start,
    stop,
  };
}

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
