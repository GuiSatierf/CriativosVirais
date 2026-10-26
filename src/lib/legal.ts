// Shared by the sign-up form, the auth rules and the legal pages.

/** Version of the terms and privacy policy; raising it asks everyone to accept again. */
export const legalVersion = 1;

/** True until the owner's lawyer reviews the text: the pages say it is a draft. */
export const legalDraft = true;

/** The sign-up request carries the accepted version here; Better Auth's body has no field for it. */
export const legalVersionHeader = "x-terms-version";

export const legalPaths = { terms: "/termos", privacy: "/privacidade", accept: "/aceitar-termos" } as const;
