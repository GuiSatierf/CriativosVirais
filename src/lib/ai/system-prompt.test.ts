import { describe, expect, it } from "vitest";
import { offerProposalNote } from "./system-prompt";

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
