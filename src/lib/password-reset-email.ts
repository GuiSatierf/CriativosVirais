import "server-only";
import { sendEmail } from "./email";
import { logError } from "./log";

export const resetLinkLifetimeSeconds = 60 * 60;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function passwordResetEmail(user: { email: string; name: string }, url: string) {
  const name = firstName(user.name);
  const greeting = name ? `Olá, ${name}.` : "Olá.";
  const lines = [
    "Recebemos um pedido para redefinir a senha da sua conta no Criativos Virais.",
    "Para criar uma senha nova, abra o link abaixo. Ele vale por 1 hora e só pode ser usado uma vez.",
  ];
  const ignore = "Se você não fez esse pedido, ignore este e-mail. Sua senha continua a mesma.";
  return {
    to: user.email,
    subject: "Redefinir sua senha · Criativos Virais",
    text: [greeting, "", ...lines, "", url, "", ignore].join("\n"),
    html: [
      `<p>${escapeHtml(greeting)}</p>`,
      ...lines.map((line) => `<p>${line}</p>`),
      `<p><a href="${escapeHtml(url)}">Criar uma senha nova</a></p>`,
      `<p>${ignore}</p>`,
    ].join("\n"),
  };
}

/**
 * Failures are logged, not thrown: the reset request answers the same way whether or not
 * the email belongs to an account, and an error only for real accounts would reveal it.
 */
export async function sendPasswordResetEmail(user: { id: string; email: string; name: string }, url: string) {
  try {
    await sendEmail(passwordResetEmail(user, url));
  } catch (error) {
    logError(`password-reset user=${user.id}`, error);
  }
}
