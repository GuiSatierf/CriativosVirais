import { describe, expect, it, vi } from "vitest";

const generation = { id: "4f1c2f8e-6a0c-4f5e-9d2b-1a2b3c4d5e6f", title: "Leva 02 · Curso" };
// The full generation (model calls plus quality review) can take longer than the chat request may live.
vi.mock("../batches", () => ({
  generateBatch: vi.fn(() => new Promise(() => {})),
  startBatchGeneration: vi.fn(async () => generation),
}));
const { updateContext } = vi.hoisted(() => ({ updateContext: vi.fn(async () => undefined) }));
vi.mock("../context", () => ({ updateContext }));

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

describe("updateClientContext chat tool", () => {
  // The assistant used to write price and proofs straight into the offer, so a misheard value reached the ads.
  it("keeps price and proofs out of the offer until the client confirms them", async () => {
    const { chatTools } = await import("./tools");
    const writer = { write: vi.fn() };
    const tools = chatTools("tenant-1", "conversation-1", writer as never);

    const result = await tools.updateClientContext.execute?.(
      { produto: "Curso de confeitaria", ticketCents: "19700", provasAutorizadas: ["Mais de 300 alunas"] },
      { toolCallId: "call-1", messages: [] } as never,
    );

    expect(updateContext).toHaveBeenCalledExactlyOnceWith("tenant-1", { produto: "Curso de confeitaria" });
    expect(writer.write).toHaveBeenCalledWith({
      type: "data-offerProposal",
      data: { ticketCents: "19700", provasAutorizadas: ["Mais de 300 alunas"] },
    });
    expect(result).toEqual({ saved: ["produto"], awaitingConfirmation: ["ticketCents", "provasAutorizadas"] });
  });
});
