import { describe, expect, it } from "vitest";
import { looksLikeSecret } from "./secrets";

// Key-shaped values are built at runtime so no credential-like literal lives in the repository.
const mixed = (size: number) => "a1B2".repeat(Math.ceil(size / 4)).slice(0, size);
const hex = (size: number) => "9f3c".repeat(Math.ceil(size / 4)).slice(0, size);

describe("secret detection in chat messages", () => {
  it("accepts ad and campaign names people quote in the chat", () => {
    for (const text of [
      "O criativo LANCAMENTO-OUTUBRO-2026-AD-042 foi o melhor da semana",
      "Campanha pk-campanha-black-friday-2026 com o anúncio REMARKETING_CARRINHO_ABANDONADO_V3",
      "utm_content=L01-C03 na campanha PERPETUO-DEPOIMENTOS-2026-Q4-AD-117",
    ])
      expect(looksLikeSecret(text), text).toBe(false);
  });

  it("still refuses keys and tokens", () => {
    for (const text of [
      `minha chave é sk-${hex(32)}`,
      `gsk_${mixed(52)}`,
      `whsec_${mixed(32)}`,
      `AKIA${mixed(16).toUpperCase()}`,
      hex(40),
      `eyJ${mixed(30)}.eyJ${mixed(40)}.${mixed(43)}`,
    ])
      expect(looksLikeSecret(text), text).toBe(true);
  });
});
