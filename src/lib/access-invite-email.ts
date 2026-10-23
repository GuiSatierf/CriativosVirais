import "server-only";
import { canSendEmail, sendEmail } from "./email";
import { brandedHtml, brandedText, type BrandedMessage } from "./email-layout";
import { authEnv } from "./env";
import { logError } from "./log";

export function accessInviteEmail(email: string) {
  const signup = new URL("/signup", authEnv().BETTER_AUTH_URL);
  signup.searchParams.set("email", email);
  const message: BrandedMessage = {
    preview: "Crie sua conta para começar.",
    greeting: "Olá.",
    paragraphs: [
      "Seu acesso ao Criativos Virais foi liberado.",
      `Crie sua conta com este e-mail (${email}) para conversar com o Estrategista, gerar levas de roteiros e ver quais criativos mais vendem.`,
    ],
    action: { label: "Criar minha conta", url: signup.toString() },
    note: "Se você não esperava este e-mail, pode ignorar. Ninguém cria conta sem acesso a este endereço.",
  };
  return {
    to: email,
    subject: "Seu acesso ao Criativos Virais foi liberado",
    text: brandedText(message),
    html: brandedHtml(message),
  };
}

/** Sent once, when the email is freed; a failed send is logged and the access stays granted. */
export async function sendAccessInvite(email: string) {
  if (!canSendEmail()) return;
  try {
    await sendEmail(accessInviteEmail(email));
  } catch (error) {
    logError("access-invite", error);
  }
}
