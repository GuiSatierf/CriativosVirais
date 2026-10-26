import { createDeepSeek } from "@ai-sdk/deepseek";
import { wrapLanguageModel } from "ai";
import { DomainError } from "../errors";
import { aiEnv, aiProviderEnv } from "../env";
import { meteringMiddleware, type MeteredCall } from "./budget";
import { fakeLanguageModel } from "./fake-model";
// Missing keys are a setup problem, not an outage: waiting does not fix it. Provider failures
// keep the "indisponível" message from the chat route.
const notConfigured = "O Estrategista ainda não foi configurado nesta instalação.";
function usesFakeModel() {
  return aiProviderEnv().AI_PROVIDER === "fake";
}
function deepSeekConfig(vision: boolean) {
  const env = aiEnv();
  const model = vision ? env?.DEEPSEEK_MODEL_VISION : env?.DEEPSEEK_MODEL_TEXT;
  if (!env || !model) throw new DomainError("unavailable", notConfigured);
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
function baseModel(vision: boolean) {
  if (usesFakeModel()) return fakeLanguageModel();
  const { apiKey, model } = deepSeekConfig(vision);
  return createDeepSeek({ apiKey })(model);
}
/** Every call is checked against the operation's monthly AI budget and its cost is recorded. */
export function textModel(call: MeteredCall & { vision?: boolean }) {
  return wrapLanguageModel({ model: baseModel(call.vision ?? false), middleware: meteringMiddleware(call) });
}
export const providerOptions = {
  deepseek: { thinking: { type: "disabled" as const } },
};

// AI SDK streaming defaults log raw provider errors, which can contain private prompts.
export function onModelError() {
  console.error("Model request failed. Check provider availability and configuration.");
}
