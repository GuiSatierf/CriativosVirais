import { describe, expect, it } from "vitest";
import { offerProposalNote, recentWithinBudget } from "./system-prompt";

describe("offerProposalNote", () => {
  // History reached the model as text only, so it forgot the card and proposed the same price again.
  it("tells the model a reply showed the price and proofs card", () => {
    const reply = {
      role: "assistant",
      parts: [
        { type: "text", text: "Anotei a sua oferta." },
        { type: "data-offerProposal", data: { ticketCents: "19700" } },
      ],
    };

    const note = offerProposalNote(reply);

    expect(note).toContain("cartão");
  });

  it("adds nothing to a reply without the card", () => {
    const reply = { role: "assistant", parts: [{ type: "text", text: "Pronto." }] };

    const note = offerProposalNote(reply);

    expect(note).toBe("");
  });
});

describe("recentWithinBudget", () => {
  // Forty long pasted messages always went whole and overflowed the model's context on every turn.
  it("keeps only the newest messages that fit, oldest first", () => {
    const history = ["a", "b", "c", "d"].map((letter) => ({ content: letter.repeat(40) }));

    const kept = recentWithinBudget(history, 100);

    expect(kept.map((message) => message.content[0])).toEqual(["c", "d"]);
  });

  it("always keeps the newest message, even past the budget", () => {
    expect(recentWithinBudget([{ content: "x".repeat(500) }], 100)).toHaveLength(1);
  });
});

