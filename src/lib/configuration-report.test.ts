import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertModelConfigured } from "./ai/model";
import { missingOptionalConfiguration } from "./env";

describe("missing AI configuration", () => {
  // No provider keys: the state of a fresh install. Values must never appear in what is reported.
  beforeAll(() => {
    for (const name of ["AI_PROVIDER", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL_TEXT", "GROQ_API_KEY", "GROQ_WHISPER_MODEL", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_OUTBOX_DIR"])
      vi.stubEnv(name, "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  // Both read the environment when called, so the stubs above apply.
  it("lists the missing optional providers by variable name only", () => {
    const missing = missingOptionalConfiguration();
    expect(missing.map((item) => item.variables).flat()).toEqual([
      "DEEPSEEK_API_KEY",
      "DEEPSEEK_MODEL_TEXT",
      "GROQ_API_KEY",
      "GROQ_WHISPER_MODEL",
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ]);
  });

  it("tells the user the assistant is not configured instead of temporarily unavailable", () => {
    expect(() => assertModelConfigured()).toThrow("O Estrategista ainda não foi configurado nesta instalação.");
  });
});
