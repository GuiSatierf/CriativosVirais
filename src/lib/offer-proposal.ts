import { z } from "zod";
import type { offerProposalSchema } from "./ai/schemas";

type OfferProposal = z.infer<typeof offerProposalSchema>;

/** The part of the saved offer that a proposal is compared with; the API sends bigint cents as text. */
export const savedOfferSchema = z
  .object({
    ticketCents: z.union([z.string(), z.number()]).nullable().optional(),
    provasAutorizadas: z.array(z.string()).nullable().optional(),
  })
  .nullable();

/** Tells whether the saved offer already holds every value the assistant proposed. */
export function proposalInOffer(
  proposal: OfferProposal,
  offer: z.infer<typeof savedOfferSchema>,
) {
  if (offer == null) return false;
  const savedTicket = offer.ticketCents == null ? null : String(offer.ticketCents);
  if (proposal.ticketCents !== undefined && savedTicket !== proposal.ticketCents) return false;
  const proposedProofs = proposal.provasAutorizadas;
  if (proposedProofs === undefined) return true;
  const savedProofs = offer.provasAutorizadas ?? [];
  return (
    savedProofs.length === proposedProofs.length &&
    savedProofs.every((proof, index) => proof === proposedProofs[index])
  );
}
