import { describe, expect, it } from "vitest";
import {
  generationTimeoutMs,
  latestGenerationStart,
  visibleGenerationStatus,
} from "./batch-generation-status";

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

  it("only starts a generation that can finish before the card gives up on it", () => {
    const now = minutesLater(0);
    const latest = latestGenerationStart(now);
    const finishedBy = new Date(now.getTime() + generationTimeoutMs);
    // The oldest generation the worker still starts must be done before it is reported abandoned.
    expect(visibleGenerationStatus("running", latest, finishedBy)).toBe("running");
    expect(latest.getTime()).toBeLessThan(now.getTime());
  });
});
