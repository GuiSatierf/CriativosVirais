import "server-only";
import { sendEmail } from "./email";
import { brandedHtml, brandedText, firstName, type BrandedMessage } from "./email-layout";
import { logError } from "./log";
import { resetLinkLifetimeLabel } from "./password-rules";

export function passwordResetEmail(user: { email: string; name: string }, url: string) {
  const name = firstName(user.name);
  const message: BrandedMessage = {
    preview: "Use o link para criar uma senha nova.",
    greeting: name ? `Olá, ${name}.` : "Olá.",
    paragraphs: [
      "Recebemos um pedido para redefinir a senha da sua conta no Criativos Virais.",
      `Para criar uma senha nova, use o botão abaixo. O link vale por ${resetLinkLifetimeLabel} e só pode ser usado uma vez.`,
    ],
    action: { label: "Criar uma senha nova", url },
    note: "Se você não fez esse pedido, ignore este e-mail. Sua senha continua a mesma.",
  };
  return {
    to: user.email,
    subject: "Redefinir sua senha · Criativos Virais",
    text: brandedText(message),
    html: brandedHtml(message),
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
