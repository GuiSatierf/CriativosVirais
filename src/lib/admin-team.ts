import "server-only";
import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessGrants, session, user } from "@/db/schema";
import { normalizeEmail } from "./access";
import { audit, type AdminActor } from "./admin";
import { sendAccessInvite } from "./access-invite-email";
import { issueEnrollmentCode } from "./admin-enrollment";
import { deleteTeamInvite, saveTeamInvite, teamInviteNote } from "./team-invites";
import { HttpError } from "./errors";
import { isStaffRole, staffRoleLabel, staffRoles, type StaffRole } from "./staff";

/** Everyone with a team role, owners first. */
export async function listTeam() {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(inArray(user.role, [...staffRoles]))
    .orderBy(asc(user.name));
  return rows
    .flatMap(({ role, twoFactorEnabled, ...row }) =>
      isStaffRole(role) ? [{ ...row, role, twoFactorEnabled: twoFactorEnabled === true }] : [],
    )
    .sort((first, second) => staffRoles.indexOf(first.role) - staffRoles.indexOf(second.role));
}

async function findMember(userId: string) {
  const [member] = await db
    .select({ id: user.id, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, userId));
  if (member == null || !isStaffRole(member.role)) throw new HttpError(404, "Pessoa não encontrada na equipe.");
  return { ...member, role: member.role };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Locks the owner rows, so two owners demoting each other at once cannot both succeed.
async function keepAnotherOwner(transaction: Transaction, userId: string) {
  const owners = await transaction.select({ id: user.id }).from(user).where(eq(user.role, "owner")).for("update");
  if (owners.some((owner) => owner.id !== userId)) return;
  throw new HttpError(409, "A equipe precisa de pelo menos um dono.");
}

function refuseSelf(actor: AdminActor, userId: string) {
  if (actor.id !== userId) return;
  throw new HttpError(400, "Você não pode mudar o seu próprio papel. Peça a outro dono.");
}

/** A code only when the person still has to turn on two-factor; it is shown once to the owner. */
async function enrollmentCodeFor(member: { id: string; twoFactorEnabled: boolean | null }) {
  if (member.twoFactorEnabled === true) return null;
  return issueEnrollmentCode(member.id);
}

/** Someone without an account: free the email, keep the role for their sign-up and email the invite. */
async function inviteTeamMember(actor: AdminActor, email: string, role: StaffRole) {
  await db
    .insert(accessGrants)
    .values({ email, note: teamInviteNote, grantedBy: actor.id })
    .onConflictDoNothing({ target: accessGrants.email });
  await saveTeamInvite(email, role, actor.email);
  await audit(actor, "team.invited", email, { role });
  // Not awaited: a slow email must not hold the panel; the sender logs its own failures.
  void sendAccessInvite(email, staffRoleLabel[role]);
  return { code: null, invited: true };
}

/** Puts an account on the team, or invites the email when it has no account yet. */
export async function addTeamMember(actor: AdminActor, email: string, role: StaffRole) {
  const normalized = normalizeEmail(email);
  const [account] = await db
    .select({ id: user.id, email: user.email, role: user.role, banned: user.banned, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`);
  if (account == null) return inviteTeamMember(actor, normalized, role);
  if (isStaffRole(account.role)) throw new HttpError(409, `Esta pessoa já é ${staffRoleLabel[account.role]} na equipe.`);
  if (account.banned === true) throw new HttpError(409, "Esta conta está bloqueada. Desbloqueie antes de pôr na equipe.");
  await db.update(user).set({ role }).where(eq(user.id, account.id));
  await audit(actor, "team.added", account.email, { role });
  return { code: await enrollmentCodeFor(account), invited: false };
}

export async function changeTeamRole(actor: AdminActor, userId: string, role: StaffRole) {
  refuseSelf(actor, userId);
  const member = await findMember(userId);
  if (member.role === role) return;
  await db.transaction(async (transaction) => {
    if (member.role === "owner") await keepAnotherOwner(transaction, userId);
    await transaction.update(user).set({ role }).where(eq(user.id, userId));
  });
  await audit(actor, "team.role_changed", member.email, { from: member.role, to: role });
}

/** The person keeps the client account but leaves the panel, is signed out everywhere and leaves any client account. */
export async function removeTeamMember(actor: AdminActor, userId: string) {
  refuseSelf(actor, userId);
  const member = await findMember(userId);
  await db.transaction(async (transaction) => {
    if (member.role === "owner") await keepAnotherOwner(transaction, userId);
    await transaction.update(user).set({ role: null }).where(eq(user.id, userId));
  });
  await db.delete(session).where(or(eq(session.userId, userId), eq(session.impersonatedBy, userId)));
  await audit(actor, "team.removed", member.email, { role: member.role });
}

export async function cancelTeamInvite(actor: AdminActor, email: string) {
  const normalized = normalizeEmail(email);
  if (!(await deleteTeamInvite(normalized))) throw new HttpError(404, "Convite não encontrado.");
  await audit(actor, "team.invite_cancelled", normalized);
}

/** New activation code for someone who has not turned on two-factor yet (the old one stops working). */
export async function issueTeamCode(actor: AdminActor, userId: string) {
  const member = await findMember(userId);
  if (member.twoFactorEnabled === true)
    throw new HttpError(409, "Esta pessoa já ativou as duas etapas. O código só serve para a primeira ativação.");
  const code = await issueEnrollmentCode(userId);
  await audit(actor, "team.code_issued", member.email);
  return { code };
}
