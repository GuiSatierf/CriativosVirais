import { describe, expect, it } from "vitest";

// No provider keys: the state of a fresh install. Values must never appear in what is reported.
Object.assign(process.env, {
  AI_PROVIDER: "",
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_MODEL_TEXT: "",
  GROQ_API_KEY: "",
  GROQ_WHISPER_MODEL: "",
});

describe("missing AI configuration", () => {
  it("lists the missing optional providers by variable name only", async () => {
    const { missingOptionalConfiguration } = await import("./env");
    const missing = missingOptionalConfiguration();
    expect(missing.map((item) => item.variables).flat()).toEqual([
      "DEEPSEEK_API_KEY",
      "DEEPSEEK_MODEL_TEXT",
      "GROQ_API_KEY",
      "GROQ_WHISPER_MODEL",
    ]);
  });

  it("tells the user the assistant is not configured instead of temporarily unavailable", async () => {
    const { assertModelConfigured } = await import("./ai/model");
    expect(() => assertModelConfigured()).toThrow("O Estrategista ainda não foi configurado nesta instalação.");
  });
});
