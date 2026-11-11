import "server-only";
import { canSendEmail, sendEmail } from "./email";
import { brandedHtml, brandedText, type BrandedMessage } from "./email-layout";
import { authEnv } from "./env";
import { logError } from "./log";

/**
 * teamRole turns the invite into "you joined the team", for someone added on the Equipe tab;
 * hasAccount sends that person to sign in, since they already have an account with this email.
 */
export type AccessInvite = { teamRole?: string; token?: string; hasAccount?: boolean };

function inviteLink(email: string, { token, hasAccount }: AccessInvite) {
  const link = new URL(hasAccount === true ? "/login" : "/signup", authEnv().BETTER_AUTH_URL);
  link.searchParams.set("email", email);
  if (token) link.searchParams.set("invite", token);
  return link.toString();
}

function inviteMessage(email: string, invite: AccessInvite): BrandedMessage {
  const url = inviteLink(email, invite);
  if (invite.teamRole != null && invite.hasAccount === true)
    return {
      preview: "Entre com a sua conta para aceitar.",
      greeting: "Olá.",
      paragraphs: [
        `Você foi convidado para a equipe do Criativos Virais, com o papel de ${invite.teamRole}.`,
        `Abra o link abaixo e entre com a sua conta deste e-mail (${email}) para aceitar.`,
      ],
      action: { label: "Aceitar o convite", url },
      note: "Se não foi você, ignore este e-mail. O convite só pode ser aceito por quem acessa esta caixa de entrada.",
    };
  return {
    preview: "Crie sua conta para começar.",
    greeting: "Olá.",
    paragraphs:
      invite.teamRole == null
        ? [
            "Seu acesso ao Criativos Virais foi liberado.",
            `Crie sua conta com este e-mail (${email}) para conversar com o Estrategista, gerar levas de roteiros e ver quais criativos mais vendem.`,
          ]
        : [
            `Seu acesso à equipe do Criativos Virais foi liberado, com o papel de ${invite.teamRole}.`,
            `Crie sua conta com este e-mail (${email}). No primeiro acesso ao painel, use o código de ativação que a pessoa que convidou você vai passar.`,
          ],
    action: { label: "Criar minha conta", url },
    note: "Se não foi você, ignore este e-mail. A conta só pode ser criada por quem acessa esta caixa de entrada.",
  };
}

export function accessInviteEmail(email: string, invite: AccessInvite = {}) {
  const message = inviteMessage(email, invite);
  return {
    to: email,
    subject: invite.teamRole == null ? "Seu acesso ao Criativos Virais foi liberado" : "Você foi convidado para a equipe do Criativos Virais",
    text: brandedText(message),
    html: brandedHtml(message),
  };
}

/** Sent once, when the email is freed; a failed send is logged and the access stays granted. */
export async function sendAccessInvite(email: string, invite: AccessInvite = {}) {
  if (!canSendEmail()) return;
  try {
    await sendEmail(accessInviteEmail(email, invite));
  } catch (error) {
    logError("access-invite", error);
  }
}
