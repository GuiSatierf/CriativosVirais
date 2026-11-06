// Shared by the legal pages. Sign-up no longer asks for acceptance, and nothing in the app links here:
// the owner decided on 2026-11-06 to keep the draft pages only reachable by their address.

/** Version of the terms and privacy policy shown on the pages. */
export const legalVersion = 1;

/** True until the owner's lawyer reviews the text: the pages say it is a draft. */
export const legalDraft = true;

export const legalPaths = { terms: "/termos", privacy: "/privacidade" } as const;
