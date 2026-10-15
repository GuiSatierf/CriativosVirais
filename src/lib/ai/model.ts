import { createDeepSeek } from "@ai-sdk/deepseek";
import { DomainError } from "../errors";
import { aiEnv } from "../env";
const unavailable =
  "O assistente está indisponível no momento. Tente novamente mais tarde.";
/** Throws a user-safe error when the text (or vision) model is not configured. */
export function assertModelConfigured(vision = false) {
  const env = aiEnv();
  const model = vision ? env?.DEEPSEEK_MODEL_VISION : env?.DEEPSEEK_MODEL_TEXT;
  if (!env || !model) throw new DomainError("unavailable", unavailable);
  return { apiKey: env.DEEPSEEK_API_KEY, model };
}
export function textModel(vision = false) {
  const { apiKey, model } = assertModelConfigured(vision);
  return createDeepSeek({ apiKey })(model);
}
export const providerOptions = {
  deepseek: { thinking: { type: "disabled" as const } },
};

// AI SDK streaming defaults log raw provider errors, which can contain private prompts.
export function onModelError() {
  console.error("Model request failed. Check provider availability and configuration.");
}
