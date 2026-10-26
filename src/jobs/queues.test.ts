import { describe, expect, it } from "vitest";
import { analysisQueue } from "./queues";

describe("analysis queues", () => {
  it("sends voice notes to their own queue so they never wait behind videos", () => {
    expect(analysisQueue("audio")).toBe("transcribe-audio");
    expect(analysisQueue("video")).toBe("analyze-video");
  });
});
