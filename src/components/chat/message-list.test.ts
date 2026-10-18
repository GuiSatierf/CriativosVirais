import { describe, expect, it } from "vitest";
import { MessageList } from "./message-list";

describe("chat message list", () => {
  it("is memoized so typing in the composer does not re-render every message", () => {
    // Chat keeps the composer text in the same component that renders the list; without memo,
    // each keystroke re-parsed the markdown of the whole conversation.
    expect((MessageList as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
