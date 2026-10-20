import { describe, expect, it } from "vitest";
import { visibleGenerationStatus } from "./batch-generation-status";

const createdAt = new Date("2026-10-20T10:00:00Z");
const minutesLater = (minutes: number) => new Date(createdAt.getTime() + minutes * 60_000);

describe("batch generation status", () => {
  it("keeps a recent generation as it is", () => {
    expect(visibleGenerationStatus("running", createdAt, minutesLater(20))).toBe("running");
    expect(visibleGenerationStatus("queued", createdAt, minutesLater(64))).toBe("queued");
  });

  it("reports a generation abandoned by a stopped worker as failed, so the card stops waiting", () => {
    expect(visibleGenerationStatus("running", createdAt, minutesLater(66))).toBe("failed");
    expect(visibleGenerationStatus("queued", createdAt, minutesLater(120))).toBe("failed");
  });

  it("never changes a finished generation", () => {
    expect(visibleGenerationStatus("done", createdAt, minutesLater(600))).toBe("done");
  });
});
