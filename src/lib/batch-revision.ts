import { DomainError } from "./errors";

/** A script the quality review failed is rewritten with the latest issues, up to this many times. */
export const maxRevisions = 3;

export const qualityRefusal =
  "A revisão de qualidade reprovou um dos roteiros mesmo depois de 3 tentativas. Peça de novo; se repetir, conte mais sobre a oferta, como resultados e provas que podem ser usados.";

type Verdict = { passed: boolean; issues: string[] };

/** Rewrites one failed item until the review passes; each attempt sees the previous issues. */
export async function reviseUntilApproved<Item>(
  item: Item,
  issues: string[],
  rewrite: (item: Item, issues: string[]) => Promise<Item>,
  review: (item: Item) => Promise<Verdict>,
) {
  let current = { item, issues };
  for (let attempt = 1; attempt <= maxRevisions; attempt++) {
    const rewritten = await rewrite(current.item, current.issues);
    const verdict = await review(rewritten);
    if (verdict.passed) return rewritten;
    // Only counts: the issues quote the client's copy, which never goes to the logs.
    console.warn(`[generate-batch] revision ${attempt} of ${maxRevisions} still failed ${verdict.issues.length} criteria.`);
    current = { item: rewritten, issues: verdict.issues };
  }
  throw new DomainError("invalid_input", qualityRefusal);
}
