import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";
import { decryptStream, encryptStream } from "./encryption";
import { deletedFileDaysToPurge, dumpDaysToDelete } from "./retention";

const key = randomBytes(32);

async function run(input: Buffer, ...steps: NodeJS.ReadWriteStream[]) {
  const chunks: Buffer[] = [];
  await pipeline(
    // Small uneven chunks exercise the header and tag crossing chunk boundaries.
    Readable.from(Array.from({ length: Math.ceil(input.length / 7) }, (_, i) => input.subarray(i * 7, i * 7 + 7))),
    ...steps,
    async function (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) chunks.push(chunk);
    },
  );
  return Buffer.concat(chunks);
}

describe("backup encryption", () => {
  it("round-trips data and hides the plaintext", async () => {
    const original = Buffer.from("cliente@exemplo.test e roteiro secreto ".repeat(50));
    const sealed = await run(original, encryptStream(key));
    expect(sealed.includes(Buffer.from("cliente@exemplo.test"))).toBe(false);
    expect(await run(sealed, decryptStream(key))).toEqual(original);
    const empty = await run(Buffer.alloc(0), encryptStream(key));
    expect(await run(empty, decryptStream(key))).toEqual(Buffer.alloc(0));
  });

  it("rejects a changed byte and a wrong key", async () => {
    const sealed = await run(Buffer.from("dados do banco"), encryptStream(key));
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 20] ^= 1;
    await expect(run(tampered, decryptStream(key))).rejects.toThrow("integrity check");
    await expect(run(sealed, decryptStream(randomBytes(32)))).rejects.toThrow("integrity check");
  });
});

describe("backup retention", () => {
  it("keeps 7 daily and 4 Sunday dumps", () => {
    // 2026-10-18 is a Sunday; 40 consecutive days back from it.
    const days = Array.from({ length: 40 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 18 - i)).toISOString().slice(0, 10),
    );
    const kept = days.filter((day) => !dumpDaysToDelete(days).includes(day));
    expect(kept).toEqual([
      "2026-10-18", "2026-10-17", "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13",
      "2026-10-12", "2026-10-11", "2026-10-04", "2026-09-27",
    ]);
  });

  it("purges removed files only after 30 days", () => {
    expect(deletedFileDaysToPurge(["2026-09-17", "2026-09-18", "2026-10-18"], "2026-10-18")).toEqual([
      "2026-09-17",
    ]);
  });
});
