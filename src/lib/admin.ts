import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { accessGrants, adminAuditLog, user } from "@/db/schema";
import { normalizeEmail } from "./access";
import { accessStatus, blockRefusal } from "./admin-rules";
import { getAuth } from "./auth";
import { HttpError } from "./errors";
import { requireSameOrigin } from "./http";
import { can, isStaffRole, type StaffPermission, type StaffRole } from "./staff";

/** Better Auth user ids in admin routes. */
export const userIdSchema = z.string().trim().min(1).max(100);

/**
 * Off while the free test with students runs, so the team opens the panel with the password
 * alone (decided on 27/10/2026). Setting it back to true restores the two-factor requirement.
 */
const panelRequiresTwoFactor = false;

export type AdminActor = { id: string; email: string; name: string; role: StaffRole };
export type AdminGate =
  | { status: "ok"; actor: AdminActor }
  | { status: "needs-two-factor"; actor: AdminActor }
  | { status: "not-admin" };

/** Who may enter /admin: a team role, and two-factor turned on before any data is shown. */
export async function adminGate(requestHeaders: Headers): Promise<AdminGate> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (session == null) return { status: "not-admin" };
  // A support visit is the client's session: it never opens the panel, even if the client later joins the team.
  const { impersonatedBy } = session.session as { impersonatedBy?: string | null };
  if (impersonatedBy != null) return { status: "not-admin" };
  const { id, email, name, role, twoFactorEnabled } = session.user;
  if (!isStaffRole(role)) return { status: "not-admin" };
  const actor = { id, email, name, role };
  if (panelRequiresTwoFactor && twoFactorEnabled !== true) return { status: "needs-two-factor", actor };
  return { status: "ok", actor };
}

/** API guard: same-origin writes only; anyone off the team gets 404, a team role without the permission 403. */
export async function requireAdmin(request: Request, permission: StaffPermission = "manage-access") {
  if (!["GET", "HEAD"].includes(request.method)) requireSameOrigin(request);
  const gate = await adminGate(request.headers);
  if (gate.status === "not-admin") throw new HttpError(404, "Não encontrado.");
  if (gate.status === "needs-two-factor")
    throw new HttpError(403, "Ative a verificação em duas etapas para usar o painel.");
  if (!can(gate.actor.role, permission)) throw new HttpError(403, "O seu papel na equipe não permite isso.");
  return gate.actor;
}

export async function audit(actor: Pick<AdminActor, "id" | "email">, action: string, targetEmail: string, details: Record<string, string> = {}) {
  await db.insert(adminAuditLog).values({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    targetEmail,
    details,
  });
}

const granter = alias(user, "granter");

export async function listAccess() {
  const rows = await db
    .select({
      id: accessGrants.id,
      email: accessGrants.email,
      source: accessGrants.source,
      note: accessGrants.note,
      createdAt: accessGrants.createdAt,
      grantedBy: granter.name,
      userId: user.id,
      banned: user.banned,
      banReason: user.banReason,
      role: user.role,
    })
    .from(accessGrants)
    .leftJoin(user, sql`lower(${user.email}) = ${accessGrants.email}`)
    .leftJoin(granter, eq(granter.id, accessGrants.grantedBy))
    .orderBy(desc(accessGrants.createdAt));
  return rows.map(({ banned, role, ...row }) => ({
    ...row,
    teamRole: isStaffRole(role) ? role : null,
    status: accessStatus({ userId: row.userId, banned }),
  }));
}

export async function grantAccess(actor: AdminActor, email: string, note: string | null) {
  const normalized = normalizeEmail(email);
  const [created] = await db
    .insert(accessGrants)
    .values({ email: normalized, note, grantedBy: actor.id })
    .onConflictDoNothing({ target: accessGrants.email })
    .returning({ id: accessGrants.id });
  if (created == null) throw new HttpError(409, "Este e-mail já tem acesso.");
  await audit(actor, "access.granted", normalized, note == null ? {} : { note });
}

export async function removeAccess(actor: AdminActor, grantId: string) {
  const [grant] = await db
    .select({ email: accessGrants.email, userId: user.id })
    .from(accessGrants)
    .leftJoin(user, sql`lower(${user.email}) = ${accessGrants.email}`)
    .where(eq(accessGrants.id, grantId));
  if (grant == null) throw new HttpError(404, "Acesso não encontrado.");
  if (grant.userId != null)
    throw new HttpError(409, "Esta pessoa já criou a conta. Para tirar o acesso, bloqueie a conta.");
  await db.delete(accessGrants).where(eq(accessGrants.id, grantId));
  await audit(actor, "access.removed", grant.email);
}

async function findAccount(userId: string) {
  const [account] = await db.select({ id: user.id, email: user.email, role: user.role }).from(user).where(eq(user.id, userId));
  if (account == null) throw new HttpError(404, "Conta não encontrada.");
  return account;
}

/** Blocks sign-in and ends every session; the reason is what the client sees when trying to enter. */
export async function blockAccount(actor: AdminActor, requestHeaders: Headers, userId: string, reason: string) {
  const account = await findAccount(userId);
  const refusal = blockRefusal(actor.id, account);
  if (refusal != null) throw new HttpError(400, refusal);
  await getAuth().api.banUser({ body: { userId, banReason: reason }, headers: requestHeaders });
  await audit(actor, "account.blocked", account.email, { reason });
}

export async function unblockAccount(actor: AdminActor, requestHeaders: Headers, userId: string) {
  const account = await findAccount(userId);
  await getAuth().api.unbanUser({ body: { userId }, headers: requestHeaders });
  await audit(actor, "account.unblocked", account.email);
}
