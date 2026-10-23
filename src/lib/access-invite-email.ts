import "server-only";
import { canSendEmail, sendEmail } from "./email";
import { brandedHtml, brandedText, type BrandedMessage } from "./email-layout";
import { authEnv } from "./env";
import { logError } from "./log";

/** teamRole turns the invite into "you joined the team", for someone added on the Equipe tab. */
export function accessInviteEmail(email: string, teamRole?: string) {
  const signup = new URL("/signup", authEnv().BETTER_AUTH_URL);
  signup.searchParams.set("email", email);
  const message: BrandedMessage = {
    preview: "Crie sua conta para começar.",
    greeting: "Olá.",
    paragraphs:
      teamRole == null
        ? [
            "Seu acesso ao Criativos Virais foi liberado.",
            `Crie sua conta com este e-mail (${email}) para conversar com o Estrategista, gerar levas de roteiros e ver quais criativos mais vendem.`,
          ]
        : [
            `Seu acesso à equipe do Criativos Virais foi liberado, com o papel de ${teamRole}.`,
            `Crie sua conta com este e-mail (${email}). No primeiro acesso ao painel, use o código de ativação que a pessoa que convidou você vai passar.`,
          ],
    action: { label: "Criar minha conta", url: signup.toString() },
    note: "Se não foi você, ignore este e-mail. A conta só pode ser criada por quem acessa esta caixa de entrada.",
  };
  return {
    to: email,
    subject: teamRole == null ? "Seu acesso ao Criativos Virais foi liberado" : "Você foi convidado para a equipe do Criativos Virais",
    text: brandedText(message),
    html: brandedHtml(message),
  };
}

/** Sent once, when the email is freed; a failed send is logged and the access stays granted. */
export async function sendAccessInvite(email: string, teamRole?: string) {
  if (!canSendEmail()) return;
  try {
    await sendEmail(accessInviteEmail(email, teamRole));
  } catch (error) {
    logError("access-invite", error);
  }
}
