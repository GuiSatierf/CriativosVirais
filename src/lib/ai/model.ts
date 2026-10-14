import { createDeepSeek } from "@ai-sdk/deepseek";
import { HttpError } from "../errors";
export function textModel(vision = false) {
  const key = process.env.DEEPSEEK_API_KEY;
  const model = vision
    ? process.env.DEEPSEEK_MODEL_VISION
    : process.env.DEEPSEEK_MODEL_TEXT;
  if (!key || !model)
    throw new HttpError(
      503,
      vision
        ? "Configure a chave DeepSeek e um modelo com entrada de imagem para analisar vídeos."
        : "Configure DEEPSEEK_API_KEY e DEEPSEEK_MODEL_TEXT para usar o chat.",
    );
  return createDeepSeek({ apiKey: key })(model);
}
export const providerOptions = {
  deepseek: { thinking: { type: "disabled" as const } },
};

// AI SDK streaming defaults log raw provider errors, which can contain private prompts.
export function onModelError() {
  console.error("Model request failed. Check provider availability and configuration.");
}
