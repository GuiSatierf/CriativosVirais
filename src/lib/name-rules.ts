export const maxNameLength = 100;

/** True for a non-blank name of at most 100 characters; emoji and accents count as one character each. */
export function isAcceptableName(name: unknown) {
  if (typeof name !== "string") return false;
  const trimmed = name.normalize("NFC").trim();
  return trimmed !== "" && Array.from(trimmed).length <= maxNameLength;
}
