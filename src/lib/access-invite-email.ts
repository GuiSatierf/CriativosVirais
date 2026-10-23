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
            `Você foi adicionado à equipe do Criativos Virais como ${teamRole}.`,
            `Crie sua conta com este e-mail (${email}). Depois, peça o código de ativação a quem te convidou para abrir o painel com a verificação em duas etapas.`,
          ],
    action: { label: "Criar minha conta", url: signup.toString() },
    note: "Se você não esperava este e-mail, pode ignorar. Ninguém cria conta sem acesso a este endereço.",
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
