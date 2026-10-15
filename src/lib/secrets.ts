/**
 * Integration credentials must never reach the model, the stored history or
 * the logs. Messages that look like they carry a key or token are refused and
 * the person is sent to the integration panel instead.
 */
const url = /\bhttps?:\/\/\S+/gi;
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const prefixed = /\b(?:sk|pk|rk|whsec|ghp|gho|xox[abps]|AKIA)[-_]?[A-Za-z0-9_-]{12,}/;
const opaque = /[A-Za-z0-9_-]{28,}|\b[A-Fa-f0-9]{24,}\b/g;

export function looksLikeSecret(text: string) {
  const clean = text.replace(url, " ").replace(uuid, " ");
  if (prefixed.test(clean)) return true;
  // Long runs mixing letters and digits read as keys, not words.
  return (clean.match(opaque) ?? []).some(
    (token) => /[0-9]/.test(token) && /[A-Za-z]/.test(token),
  );
}

export const secretWarning =
  "Por segurança, não envie chaves, tokens ou senhas pelo chat. Conecte a integração pelo painel Integrações.";
