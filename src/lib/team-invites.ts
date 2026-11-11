import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, like, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessGrants, adminAuditLog, user, verification } from "@/db/schema";
import { normalizeEmail } from "./access";
import { isStaffRole, staffRoles, type StaffRole } from "./staff";
import { teamInviteTokenSchema } from "./team-invite-token";

/**
 * A team role waiting for the invited person: it applies when they sign up, or when someone who
 * already has an account opens the emailed link and signs in. The emailed secret proves the mailbox.
 */
const inviteValidMs = 7 * 24 * 60 * 60_000;
const prefix = "team-invite:";
const inviteSchema = z.object({ role: z.enum(staffRoles), by: z.string(), tokenHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function acceptsToken(value: string, token: string | null) {
  const invite = inviteSchema.safeParse(JSON.parse(value)).data;
  const parsed = teamInviteTokenSchema.safeParse(token);
  if (!invite?.tokenHash || !parsed.success) return false;
  return timingSafeEqual(Buffer.from(invite.tokenHash, "hex"), Buffer.from(hashToken(parsed.data), "hex"));
}

/** An invited email may only sign up using the secret delivered to its mailbox. */
export async function canAcceptTeamInvite(email: string, token: string | null) {
  await pruneExpiredTeamInvites();
  const [stored] = await db.select({ value: verification.value }).from(verification)
    .where(and(eq(verification.identifier, identifierOf(email)), gt(verification.expiresAt, new Date())));
  return stored == null || acceptsToken(stored.value, token);
}

const identifierOf = (email: string) => `${prefix}${normalizeEmail(email)}`;
/** Note on the access grant an invite creates, so an unused invite can take its grant back. */
export const teamInviteNote = "Convite para a equipe";

// Without this, an expired or cancelled invite would leave a grant anyone with that mailbox could
// use to sign up as a client without buying.
async function dropUnusedInviteGrant(email: string) {
  await db
    .delete(accessGrants)
    .where(
      and(
        eq(accessGrants.email, normalizeEmail(email)),
        eq(accessGrants.note, teamInviteNote),
        sql`not exists (select 1 from ${user} where lower(${user.email}) = ${normalizeEmail(email)})`,
      ),
    );
}

/** Expired invites leave the list together with the grant they created. */
async function pruneExpiredTeamInvites() {
  const expired = await db
    .delete(verification)
    .where(and(like(verification.identifier, `${prefix}%`), lte(verification.expiresAt, new Date())))
    .returning({ identifier: verification.identifier });
  for (const row of expired) await dropUnusedInviteGrant(row.identifier.slice(prefix.length));
}

export async function saveTeamInvite(email: string, role: StaffRole, invitedBy: string) {
  const identifier = identifierOf(email);
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (transaction) => {
    await transaction.delete(verification).where(eq(verification.identifier, identifier));
    await transaction.insert(verification).values({
      id: randomUUID(),
      identifier,
      value: JSON.stringify({ role, by: invitedBy, tokenHash: hashToken(token) }),
      expiresAt: new Date(Date.now() + inviteValidMs),
    });
  });
  return token;
}

export async function listTeamInvites() {
  await pruneExpiredTeamInvites();
  const rows = await db
    .select({ identifier: verification.identifier, value: verification.value, expiresAt: verification.expiresAt })
    .from(verification)
    .where(and(like(verification.identifier, `${prefix}%`), gt(verification.expiresAt, new Date())));
  return rows.flatMap((row) => {
    const invite = inviteSchema.safeParse(JSON.parse(row.value)).data;
    if (invite == null) return [];
    return [{ email: row.identifier.slice(prefix.length), role: invite.role, expiresAt: row.expiresAt }];
  });
}

export async function deleteTeamInvite(email: string) {
  const deleted = await db
    .delete(verification)
    .where(eq(verification.identifier, identifierOf(email)))
    .returning({ id: verification.id });
  if (deleted.length > 0) await dropUnusedInviteGrant(email);
  return deleted.length > 0;
}

async function openInvite(email: string, token: string | null) {
  const [stored] = await db
    .select({ value: verification.value })
    .from(verification)
    .where(and(eq(verification.identifier, identifierOf(email)), gt(verification.expiresAt, new Date())));
  if (stored == null || acceptsToken(stored.value, token) === false) return null;
  const invite = inviteSchema.safeParse(JSON.parse(stored.value)).data;
  if (invite == null || isStaffRole(invite.role) === false) return null;
  return { value: stored.value, invite };
}

/** The role an invite link offers, or null when it does not match an open invite for this email. */
export async function teamInviteRole(email: string, token: string | null) {
  return (await openInvite(email, token))?.invite.role ?? null;
}

/**
 * Gives the account its team role when the token matches the open invite for its email; called
 * when a new account is created and when an existing account signs in through the invite link.
 * Returns whether the account joined the team.
 */
export async function applyTeamInvite(account: { id: string; email: string }, token: string | null) {
  const open = await openInvite(account.email, token);
  if (open == null) return false;
  const identifier = identifierOf(account.email);
  return db.transaction(async (transaction) => {
    const consumed = await transaction.delete(verification)
      .where(and(eq(verification.identifier, identifier), eq(verification.value, open.value), gt(verification.expiresAt, new Date())))
      .returning({ id: verification.id });
    if (consumed.length === 0) return false;
    // A team member's role changes only on the Equipe tab, so an old link cannot demote an owner.
    // The emailed token also proves the mailbox, so the email counts as confirmed.
    const joined = await transaction
      .update(user)
      .set({ role: open.invite.role, emailVerified: true })
      .where(and(eq(user.id, account.id), or(isNull(user.role), eq(user.role, "user"))))
      .returning({ id: user.id });
    if (joined.length === 0) return false;
    await transaction.insert(adminAuditLog).values({
      actorEmail: open.invite.by,
      action: "team.joined",
      targetEmail: normalizeEmail(account.email),
      details: { role: open.invite.role },
    });
    return true;
  });
}
