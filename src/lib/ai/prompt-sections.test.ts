import { describe, expect, it } from "vitest";
import { assembleSystemPrompt } from "./prompt-sections";

const long = (size: number) => "x".repeat(size);
const master = long(54_000);

// Every section at the largest size the database and schemas allow today.
const largest = {
  conversation: Array.from({ length: 10 }, () => ({ role: "user", text: long(6_000) })),
  evidence: Array.from({ length: 12 }, () => ({ creativeKey: "L01-C01", transcript: long(100_000), narrative: long(8_000) })),
  definitions: [{ provider: "csv", metadata: { hook_rate: long(500), body_rate: long(500) } }],
  sources: [{ source: "csv", from: "2026-10-01", to: "2026-10-15" }],
  context: {
    produto: long(4_000), publico: long(4_000), transformacao: long(4_000), mecanismo: long(4_000),
    provasAutorizadas: Array.from({ length: 30 }, () => long(4_000)),
    objecoes: Array.from({ length: 30 }, () => long(4_000)),
    notas: Array.from({ length: 50 }, () => long(4_000)),
  },
  recent: {
    recent: Array.from({ length: 3 }, () => ({ title: long(300) })),
    items: Array.from({ length: 36 }, () => ({ ideia: long(8_000), narrativa: long(8_000), hipotese: long(8_000) })),
  },
  learned: Array.from({ length: 30 }, () => ({ texto: long(4_000), evidenceLevel: "hipotese" })),
  patterns: Array.from({ length: 12 }, () => ({ descricao: long(2_000) })),
};

describe("system prompt size", () => {
  it("keeps tenant data within the budget when every section is at its maximum", () => {
    const prompt = assembleSystemPrompt(master, largest);
    // About 130k characters of data and instructions on top of the master document (~40k tokens).
    expect(prompt.length).toBeLessThanOrEqual(master.length + 130_000);
  });

  it("leaves small data untouched", () => {
    const small = { ...largest, conversation: [{ role: "user", text: "Oi" }], evidence: [], context: { produto: "Curso" },
      recent: { recent: [], items: [] }, learned: [], patterns: [] };
    const prompt = assembleSystemPrompt(master, small);
    expect(prompt).toContain('"produto":"Curso"');
    expect(prompt).toContain('"text":"Oi"');
  });
});
