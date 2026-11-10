import { describe, expect, it } from "vitest";
import { probeRejectedFile } from "./analyze-video";

// A text file renamed to .mp4 failed with "tente novamente em alguns minutos", which a retry never fixes.
describe("ffprobe failures", () => {
  it("blames the file when ffprobe exits with an error code", () => {
    const refused = Object.assign(new Error("Invalid data found when processing input"), { code: 1, killed: false });

    expect(probeRejectedFile(refused)).toBe(true);
  });

  it("does not blame the file for a timeout or a missing ffprobe", () => {
    const timedOut = Object.assign(new Error("timeout"), { code: null, killed: true, signal: "SIGTERM" });
    const missing = Object.assign(new Error("spawn ffprobe ENOENT"), { code: "ENOENT" });

    expect(probeRejectedFile(timedOut)).toBe(false);
    expect(probeRejectedFile(missing)).toBe(false);
  });
});
