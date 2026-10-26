import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribe, transcriptionVocabulary } from "./transcribe";

describe("transcription request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends the app's vocabulary so words like roteiros are not misheard", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_WHISPER_MODEL", "whisper-large-v3");
    const fetch = vi.fn(async () => Response.json({ text: "Qual dos três roteiros vendeu mais?" }));
    vi.stubGlobal("fetch", fetch);

    await transcribe(new Uint8Array([1, 2, 3]), "audio.mp3", "audio/mpeg");

    const body = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(body.get("language")).toBe("pt");
    expect(body.get("prompt")).toBe(transcriptionVocabulary);
    expect(transcriptionVocabulary).toContain("roteiros");
  });
});
