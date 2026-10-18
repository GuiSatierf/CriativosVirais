import { describe, expect, it, vi } from "vitest";

const generation = { id: "4f1c2f8e-6a0c-4f5e-9d2b-1a2b3c4d5e6f", title: "Leva 02 · Curso" };
// The full generation (model calls plus quality review) can take longer than the chat request may live.
vi.mock("../batches", () => ({
  generateBatch: vi.fn(() => new Promise(() => {})),
  startBatchGeneration: vi.fn(async () => generation),
}));

describe("generateBatch chat tool", () => {
  it("answers right away and leaves the generation to the worker", async () => {
    const { chatTools } = await import("./tools");
    const writer = { write: vi.fn() };
    const tools = chatTools("tenant-1", "conversation-1", writer as never);
    const waited = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("the chat request waited for the whole generation")), 1_000),
    );
    const result = await Promise.race([
      tools.generateBatch.execute!({ quantidade: 2, instrucoes: "ganchos curtos" }, { toolCallId: "call-1", messages: [] } as never),
      waited,
    ]);
    expect(result).toMatchObject({ status: "queued", title: generation.title });
    expect(writer.write).toHaveBeenCalledWith({ type: "data-generation", data: generation });
  });
});
