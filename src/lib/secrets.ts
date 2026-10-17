/**
 * Integration credentials must never reach the model, the stored history or
 * the logs. Messages that look like they carry a key or token are refused and
 * the person is sent to the integration panel instead.
 */
const url = /\bhttps?:\/\/\S+/gi;
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const prefixed = /\b(?:sk|pk|rk|gsk|whsec|ghp|gho|xox[abps]|AKIA)[-_]?([A-Za-z0-9_-]{12,})/g;
const opaque = /[A-Za-z0-9_-]{20,}/g;
const hexRun = /\b[A-Fa-f0-9]{24,}\b/;

// Keys are long random runs mixing letters and digits. Ad and campaign names
// ("LANCAMENTO-OUTUBRO-2026-AD-042") are short words joined by - or _, so each
// piece between separators is judged on its own.
function hasRandomPiece(token: string, minLength: number) {
  return token
    .split(/[-_]/)
    .some((piece) => piece.length >= minLength && /[0-9]/.test(piece) && /[A-Za-z]/.test(piece));
}

export function looksLikeSecret(text: string) {
  const clean = text.replace(url, " ").replace(uuid, " ");
  if (hexRun.test(clean)) return true;
  if ([...clean.matchAll(prefixed)].some((match) => hasRandomPiece(match[1], 12))) return true;
  return (clean.match(opaque) ?? []).some((token) => hasRandomPiece(token, 20));
}

export const secretWarning =
  "Por segurança, não envie chaves, tokens ou senhas pelo chat. Conecte a integração pelo painel Integrações.";
