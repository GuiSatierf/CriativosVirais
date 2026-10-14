import { z } from "zod";
export const transcriptSchema = z.object({
  text: z.string().max(100000),
  duration: z.number().nonnegative().optional(),
  segments: z
    .array(
      z.object({
        start: z.number().nonnegative(),
        end: z.number().nonnegative(),
        text: z.string().max(10000),
      }).refine((segment) => segment.end >= segment.start),
    )
    .max(1000)
    .default([]),
});
export async function transcribe(
  bytes: Uint8Array,
  name: string,
  mime: string,
) {
  if (!process.env.GROQ_API_KEY || !process.env.GROQ_WHISPER_MODEL)
    throw new Error(
      "Configure GROQ_API_KEY e GROQ_WHISPER_MODEL para transcrever áudio.",
    );
  if (bytes.length > 25_000_000)
    throw new Error("Áudio excede 25 MB após extração.");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), name);
  form.set("model", process.env.GROQ_WHISPER_MODEL);
  form.set("language", "pt");
  form.set("response_format", "verbose_json");
  form.set("timestamp_granularities[]", "segment");
  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Falha na transcrição. Verifique a configuração Groq e os limites de uso.",
    );
  return transcriptSchema.parse(await response.json());
}
