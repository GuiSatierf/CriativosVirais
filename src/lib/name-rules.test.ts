import { describe, expect, test } from "vitest";
import { isAcceptableName } from "./name-rules";

describe("account name rule", () => {
  test("accepts 100 emoji, which are 200 UTF-16 units", () => {
    expect(isAcceptableName("😀".repeat(100))).toBe(true);
  });
  test("counts decomposed accents as one character", () => {
    expect(isAcceptableName("e\u0301".repeat(100))).toBe(true);
  });
  test("refuses 101 characters, blank and non-string names", () => {
    expect(isAcceptableName("a".repeat(101))).toBe(false);
    expect(isAcceptableName("   ")).toBe(false);
    expect(isAcceptableName(undefined)).toBe(false);
  });
});
