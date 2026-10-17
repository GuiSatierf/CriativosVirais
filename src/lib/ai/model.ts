import { createDeepSeek } from "@ai-sdk/deepseek";
import { DomainError } from "../errors";
import { aiEnv, aiProviderEnv } from "../env";
import { fakeLanguageModel } from "./fake-model";
const unavailable =
  "O assistente está indisponível no momento. Tente novamente mais tarde.";
function usesFakeModel() {
  return aiProviderEnv().AI_PROVIDER === "fake";
}
function deepSeekConfig(vision: boolean) {
  const env = aiEnv();
  const model = vision ? env?.DEEPSEEK_MODEL_VISION : env?.DEEPSEEK_MODEL_TEXT;
  if (!env || !model) throw new DomainError("unavailable", unavailable);
  return { apiKey: env.DEEPSEEK_API_KEY, model };
}
/** Whether the chat can answer; used by pages to show the assistant as available. */
export function isModelConfigured() {
  return usesFakeModel() || Boolean(aiEnv()?.DEEPSEEK_MODEL_TEXT);
}
/** Throws a user-safe error when the text (or vision) model is not configured. */
export function assertModelConfigured(vision = false) {
  if (usesFakeModel()) return;
  deepSeekConfig(vision);
}
export function textModel(vision = false) {
  if (usesFakeModel()) return fakeLanguageModel();
  const { apiKey, model } = deepSeekConfig(vision);
  return createDeepSeek({ apiKey })(model);
}
export const providerOptions = {
  deepseek: { thinking: { type: "disabled" as const } },
};

// AI SDK streaming defaults log raw provider errors, which can contain private prompts.
export function onModelError() {
  console.error("Model request failed. Check provider availability and configuration.");
}
