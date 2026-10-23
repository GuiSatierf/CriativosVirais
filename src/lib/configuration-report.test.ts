import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertModelConfigured, isModelConfigured } from "./ai/model";
import { missingOptionalConfiguration } from "./env";

describe("missing AI configuration", () => {
  // No provider keys: the state of a fresh install. Values must never appear in what is reported.
  beforeAll(() => {
    for (const name of ["AI_PROVIDER", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL_TEXT", "GROQ_API_KEY", "GROQ_WHISPER_MODEL", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_OUTBOX_DIR", "HOTMART_HOTTOK", "HOTMART_PRODUCT_IDS"])
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
      "HOTMART_HOTTOK",
      "HOTMART_PRODUCT_IDS",
    ]);
  });

  it("tells the user the assistant is not configured instead of temporarily unavailable", () => {
    expect(() => assertModelConfigured()).toThrow("O Estrategista ainda não foi configurado nesta instalação.");
  });
});

describe("text model without a vision model", () => {
  // docker-compose.coolify.yml passes an unset DEEPSEEK_MODEL_VISION as an empty string.
  beforeAll(() => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_MODEL_TEXT", "deepseek-chat");
    vi.stubEnv("DEEPSEEK_MODEL_VISION", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the chat available and refuses only vision requests", () => {
    expect(isModelConfigured()).toBe(true);
    expect(() => assertModelConfigured()).not.toThrow();
    expect(() => assertModelConfigured(true)).toThrow("O Estrategista ainda não foi configurado nesta instalação.");
  });
});
