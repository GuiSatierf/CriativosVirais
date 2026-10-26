import { z } from "zod";
import { DomainError } from "./errors";
import { transcribeEnv } from "./env";
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
// Whisper's prompt nudges spelling toward words it would otherwise mishear: "roteiros" came out as
// "votos" and "motivos" in production. It is a style hint, never an instruction to the model.
export const transcriptionVocabulary =
  "Conversa sobre anúncios em vídeo no Criativos Virais: roteiros, leva, criativos, ganchos, corpo do roteiro, Estrategista, oferta, Hotmart, UTMify, vendas, investimento, retorno, CTR, ROAS.";
const unavailable =
  "Não foi possível transcrever o áudio. Tente novamente em alguns minutos.";
export async function transcribe(
  bytes: Uint8Array,
  name: string,
  mime: string,
) {
  const env = transcribeEnv();
  if (!env) throw new DomainError("unavailable", unavailable);
  if (bytes.length > 25_000_000)
    throw new DomainError(
      "invalid_input",
      "O áudio é longo demais para transcrever. Envie um arquivo mais curto.",
    );
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), name);
  form.set("model", env.GROQ_WHISPER_MODEL);
  form.set("language", "pt");
  form.set("prompt", transcriptionVocabulary);
  form.set("response_format", "verbose_json");
  form.set("timestamp_granularities[]", "segment");
  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    console.error(`Transcription request failed with status ${response.status}`);
    throw new DomainError("unavailable", unavailable);
  }
  return transcriptSchema.parse(await response.json());
}
