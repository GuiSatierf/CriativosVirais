import { describe, expect, it } from "vitest";
import { meterStream, type StreamUsage } from "./budget";

type Part = Parameters<typeof meterStream>[0] extends ReadableStream<infer P> ? P : never;

const usage = {
  inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 40, text: 40, reasoning: 0 },
};
const parts: Part[] = [
  { type: "stream-start", warnings: [] },
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: "Olá, " },
  { type: "text-delta", id: "t", delta: "tudo bem?" },
  { type: "text-end", id: "t" },
  { type: "finish", usage, finishReason: { unified: "stop", raw: "stop" } },
];

function providerStream() {
  return new ReadableStream<Part>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function recorder() {
  const recorded: StreamUsage[] = [];
  return { recorded, record: async (entry: StreamUsage) => void recorded.push(entry) };
}

describe("meterStream", () => {
  it("records the provider's usage once when the reply finishes", async () => {
    const { recorded, record } = recorder();

    await Array.fromAsync(meterStream(providerStream(), 300, record));

    expect(recorded).toEqual([{ reported: usage }]);
  });

  it("records an estimate when the reader cancels before the finish part, as when the tab closes", async () => {
    const { recorded, record } = recorder();
    const reader = meterStream(providerStream(), 300, record).getReader();

    for (let read = 0; read < 4; read++) await reader.read();
    await reader.cancel(new Error("client closed the tab"));

    expect(recorded).toEqual([{ estimated: { inputTokens: 100, outputTokens: 5 } }]);
  });

  it("records an estimate when the provider stream fails before the finish part", async () => {
    const { recorded, record } = recorder();
    let pulls = 0;
    const failing = new ReadableStream<Part>({
      pull(controller) {
        pulls++;
        if (pulls === 1) return controller.enqueue({ type: "text-delta", id: "t", delta: "abcdef" });
        controller.error(new Error("connection reset"));
      },
    });

    await expect(Array.fromAsync(meterStream(failing, 30, record))).rejects.toThrow("connection reset");

    expect(recorded).toEqual([{ estimated: { inputTokens: 10, outputTokens: 2 } }]);
  });
});
