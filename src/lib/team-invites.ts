import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminAuditLog, user, verification } from "@/db/schema";
import { normalizeEmail } from "./access";
import { isStaffRole, staffRoles, type StaffRole } from "./staff";

/** A team role waiting for someone who has no account yet; it applies when they sign up. */
const inviteValidMs = 7 * 24 * 60 * 60_000;
const prefix = "team-invite:";
const inviteSchema = z.object({ role: z.enum(staffRoles), by: z.string() });

const identifierOf = (email: string) => `${prefix}${normalizeEmail(email)}`;

export async function saveTeamInvite(email: string, role: StaffRole, invitedBy: string) {
  const identifier = identifierOf(email);
  await db.transaction(async (transaction) => {
    await transaction.delete(verification).where(eq(verification.identifier, identifier));
    await transaction.insert(verification).values({
      id: randomUUID(),
      identifier,
      value: JSON.stringify({ role, by: invitedBy }),
      expiresAt: new Date(Date.now() + inviteValidMs),
    });
  });
}

export async function listTeamInvites() {
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
  return deleted.length > 0;
}

/** Called once a new account exists: an open invite gives it its team role. */
export async function applyTeamInvite(account: { id: string; email: string }) {
  const identifier = identifierOf(account.email);
  const [stored] = await db
    .select({ value: verification.value })
    .from(verification)
    .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())));
  if (stored == null) return;
  const invite = inviteSchema.safeParse(JSON.parse(stored.value)).data;
  await db.delete(verification).where(eq(verification.identifier, identifier));
  if (invite == null || !isStaffRole(invite.role)) return;
  await db.update(user).set({ role: invite.role }).where(eq(user.id, account.id));
  await db.insert(adminAuditLog).values({
    actorEmail: invite.by,
    action: "team.joined",
    targetEmail: normalizeEmail(account.email),
    details: { role: invite.role },
  });
}
