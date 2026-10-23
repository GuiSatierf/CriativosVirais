import { isStaffRole } from "./staff";

export type AccessStatus = "waiting" | "active" | "blocked";

/** Status shown in the list: no account yet, account in use, or account blocked. */
export function accessStatus(account: { userId: string | null; banned: boolean | null }): AccessStatus {
  if (account.userId == null) return "waiting";
  if (account.banned === true) return "blocked";
  return "active";
}

/**
 * Why the panel refuses to block an account, or null when it may. Team members are never blocked from
 * the panel, so a stolen session cannot lock the others out; the owner removes them from the team instead.
 */
export function blockRefusal(actorId: string, target: { id: string; role: string | null }) {
  if (target.id === actorId) return "Você não pode bloquear a própria conta.";
  if (isStaffRole(target.role))
    return "Contas da equipe não são bloqueadas pelo painel. O dono tira a pessoa da equipe na aba Equipe.";
  return null;
}
