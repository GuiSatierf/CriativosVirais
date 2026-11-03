import "server-only";
import { and, desc, eq, ilike, isNull, max, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessGrants, session, user } from "@/db/schema";
import { normalizeEmail } from "./access";
import { audit, containsPattern, type AdminActor } from "./admin";
import { getAuth } from "./auth";
import { HttpError } from "./errors";
import { isStaffRole, staffRoles } from "./staff";

const pageSize = 50;
const clientsOnly = or(isNull(user.role), notInArray(user.role, [...staffRoles]));

/** Client accounts, most recently active first; the search matches name or email. */
export async function listAccounts(query: string) {
  const term = query.trim();
  const pattern = containsPattern(term);
  const search = term.length === 0 ? undefined : or(ilike(user.email, pattern), ilike(user.name, pattern));
  // Only the client's own sessions count as access, not the team's visits.
  const lastAccess = max(sql`case when ${session.impersonatedBy} is null then ${session.updatedAt} end`).mapWith(
    (value: string | Date | null) => (value == null ? null : new Date(value)),
  );
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned, lastAccess })
    .from(user)
    .leftJoin(session, eq(session.userId, user.id))
    .where(and(clientsOnly, search))
    .groupBy(user.id)
    .orderBy(sql`${lastAccess} desc nulls last`, desc(user.createdAt))
    .limit(pageSize);
  return rows.map(({ banned, ...row }) => ({ ...row, blocked: banned === true }));
}

async function findClient(userId: string) {
  const [client] = await db
    .select({ id: user.id, email: user.email, role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId));
  if (client == null) throw new HttpError(404, "Conta não encontrada.");
  if (isStaffRole(client.role)) throw new HttpError(400, "Contas da equipe não podem ser alteradas pela aba Contas.");
  return client;
}

/**
 * Opens a one-hour session inside the client's account; the team member's own session waits in a
 * separate cookie until they leave. Returns the cookies to set on the response.
 */
export async function enterAccount(actor: AdminActor, requestHeaders: Headers, userId: string, reason: string) {
  const client = await findClient(userId);
  if (client.banned === true) throw new HttpError(409, "Esta conta está bloqueada. Desbloqueie antes de entrar.");
  const { headers, response } = await getAuth().api.impersonateUser({
    body: { userId },
    headers: requestHeaders,
    returnHeaders: true,
  });
  // A visit nobody ends with "Sair da conta" ends at this time; account.left only records early exits.
  const until = new Date(response.session.expiresAt).toISOString();
  await audit(actor, "account.entered", client.email, { reason, until });
  return headers.getSetCookie();
}

/** Changes the sign-in email; the access grant follows it so the Acessos tab stays matched. */
export async function changeClientEmail(actor: AdminActor, userId: string, email: string) {
  const client = await findClient(userId);
  const next = normalizeEmail(email);
  const previous = normalizeEmail(client.email);
  if (next === previous) return;
  const [taken] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${next}`);
  if (taken != null) throw new HttpError(409, "Já existe uma conta com este e-mail.");
  await db.transaction(async (transaction) => {
    await transaction.update(user).set({ email: next, emailVerified: false }).where(eq(user.id, userId));
    const [grantForNext] = await transaction.select({ id: accessGrants.id }).from(accessGrants).where(eq(accessGrants.email, next));
    if (grantForNext != null) return transaction.delete(accessGrants).where(eq(accessGrants.email, previous));
    await transaction.update(accessGrants).set({ email: next }).where(eq(accessGrants.email, previous));
  });
  await audit(actor, "account.email_changed", next, { from: previous });
}

/** Sets a new password the team tells the client; it never reaches the audit log. */
export async function setClientPassword(actor: AdminActor, requestHeaders: Headers, userId: string, password: string) {
  const client = await findClient(userId);
  await getAuth().api.setUserPassword({ body: { userId, newPassword: password }, headers: requestHeaders });
  await audit(actor, "account.password_set", client.email);
}

type SignedIn = {
  session: { impersonatedBy?: string | null; expiresAt: Date };
  user: { name: string; email: string };
};

/** Who is inside this account for support, and until when; null in a client's own session. */
export async function describeSupportVisit({ session: current, user: client }: SignedIn) {
  const staffId = current.impersonatedBy;
  if (staffId == null) return null;
  const [staff] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, staffId));
  return {
    staffId,
    staffName: staff?.name ?? "Equipe",
    staffEmail: staff?.email ?? "",
    clientName: client.name,
    clientEmail: client.email,
    endsAt: current.expiresAt,
  };
}

/** Ends the visit and puts the team member's own session back. */
export async function leaveAccount(requestHeaders: Headers) {
  const current = await getAuth().api.getSession({ headers: requestHeaders });
  const visit = current == null ? null : await describeSupportVisit(current);
  if (visit == null) throw new HttpError(400, "Você não está na conta de um cliente.");
  const { headers } = await getAuth().api.stopImpersonating({ headers: requestHeaders, returnHeaders: true });
  await audit({ id: visit.staffId, email: visit.staffEmail }, "account.left", visit.clientEmail);
  return headers.getSetCookie();
}
