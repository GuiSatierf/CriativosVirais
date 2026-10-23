export type AccessStatus = "waiting" | "active" | "blocked";

/** Status shown in the list: no account yet, account in use, or account blocked. */
export function accessStatus(account: { userId: string | null; banned: boolean | null }): AccessStatus {
  if (account.userId == null) return "waiting";
  if (account.banned === true) return "blocked";
  return "active";
}

/**
 * Why the panel refuses to block an account, or null when it may. Admins are never blocked from the
 * panel, so a stolen admin session cannot lock the others out; removing an admin is a server command.
 */
export function blockRefusal(actorId: string, target: { id: string; role: string | null }) {
  if (target.id === actorId) return "Você não pode bloquear a própria conta.";
  if (target.role === "admin")
    return "Contas de admin não são bloqueadas pelo painel. Peça a quem tem acesso ao servidor para usar o comando remove-admin.";
  return null;
}
