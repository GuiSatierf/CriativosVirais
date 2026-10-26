import { describe, expect, it, vi } from "vitest";
import { DomainError } from "./errors";
import { maxRevisions, reviseUntilApproved } from "./batch-revision";

describe("batch revision", () => {
  it("keeps rewriting a failed script with the latest issues until the review passes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rewrite = vi.fn(async (_item: string, issues: string[]) => `rewritten after ${issues[0]}`);
    const verdicts = [
      { passed: false, issues: ["second"] },
      { passed: true, issues: [] },
    ];
    const review = vi.fn(async () => verdicts.shift() ?? { passed: true, issues: [] });

    // A single second failure used to throw away the whole batch.
    await expect(reviseUntilApproved("draft", ["first"], rewrite, review)).resolves.toBe("rewritten after second");
    expect(rewrite.mock.calls.map(([, issues]) => issues)).toEqual([["first"], ["second"]]);
  });

  it("gives up with a plain message after the last attempt", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rewrite = vi.fn(async (item: string) => item);
    const review = vi.fn(async () => ({ passed: false, issues: ["still"] }));

    await expect(reviseUntilApproved("draft", ["first"], rewrite, review)).rejects.toBeInstanceOf(DomainError);
    expect(rewrite).toHaveBeenCalledTimes(maxRevisions);
  });
});
