import "server-only";
import { sendEmail } from "./email";
import { brandedHtml, brandedText, firstName, type BrandedMessage } from "./email-layout";

export function emailConfirmationEmail(user: { email: string; name: string }, url: string) {
  const name = firstName(user.name);
  const message: BrandedMessage = {
    preview: "Confirme que este e-mail é seu.",
    greeting: name ? `Olá, ${name}.` : "Olá.",
    paragraphs: [
      "Para trocar a senha, excluir a conta ou ligar a verificação em duas etapas no Criativos Virais, confirme antes que este e-mail é seu.",
      "Use o botão abaixo. O link vale por 1 hora.",
    ],
    action: { label: "Confirmar meu e-mail", url },
    note: "Se você não pediu isso, ignore este e-mail. Nada muda na sua conta.",
  };
  return {
    to: user.email,
    subject: "Confirme seu e-mail · Criativos Virais",
    text: brandedText(message),
    html: brandedHtml(message),
  };
}

/** The person asked for it from the profile page, so a failed send surfaces as an error there. */
export async function sendEmailConfirmation(user: { email: string; name: string }, url: string) {
  await sendEmail(emailConfirmationEmail(user, url));
}
