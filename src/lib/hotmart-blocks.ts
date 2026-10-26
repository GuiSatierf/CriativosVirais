import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessGrants, adminAuditLog, session, user } from "@/db/schema";

// Shared by the webhook and the worker, which ends a cancelled subscription when its paid period is over.
export const hotmartActor = "Hotmart";
export const hotmartBlockReasons = {
  PURCHASE_REFUNDED: "compra reembolsada na Hotmart",
  PURCHASE_CHARGEBACK: "chargeback da compra na Hotmart",
  SUBSCRIPTION_CANCELLATION: "assinatura cancelada na Hotmart",
} as const;
const hotmartBlocks: readonly string[] = Object.values(hotmartBlockReasons);

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** True when the account's block came from Hotmart, so a new purchase may lift it. */
export function isHotmartBlock(reason: string | null) {
  return reason != null && hotmartBlocks.includes(reason);
}

/** Hotmart may deliver an approval and its reversal at the same time; one buyer's events run one at a time. */
export async function lockBuyer(tx: Transaction, email: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 3))`);
}

export async function auditHotmart(tx: Transaction, action: string, email: string, details: Record<string, string>) {
  await tx.insert(adminAuditLog).values({ actorEmail: hotmartActor, action, targetEmail: email, details });
}

export async function findBuyerAccount(tx: Transaction, email: string) {
  const [account] = await tx
    .select({ id: user.id, role: user.role, banned: user.banned, banReason: user.banReason })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`);
  return account ?? null;
}

/** A refund, chargeback or cancellation takes access away; a team account is never touched from outside. */
export async function revokeBuyerAccess(tx: Transaction, email: string, reason: string, details: Record<string, string>) {
  const account = await findBuyerAccount(tx, email);
  if (account == null) {
    await tx.delete(accessGrants).where(and(eq(accessGrants.email, email), eq(accessGrants.source, "hotmart")));
    return auditHotmart(tx, "access.removed", email, { reason, ...details });
  }
  // Any role other than a plain client is the team (admin today, owner and support later).
  const onTeam = account.role != null && account.role !== "user";
  if (onTeam) return auditHotmart(tx, "access.revoke_skipped", email, { reason, ...details });
  // A block the team put on the account keeps its reason, so a later purchase cannot lift it.
  const blockedByTeam = account.banned === true && isHotmartBlock(account.banReason) === false;
  if (blockedByTeam) return auditHotmart(tx, "access.revoked", email, { reason, ...details });
  await tx.update(user).set({ banned: true, banReason: reason, banExpires: null }).where(eq(user.id, account.id));
  await tx.delete(session).where(eq(session.userId, account.id));
  await auditHotmart(tx, "account.blocked", email, { reason, ...details });
}

/** A purchase recorded after the cancellation means the buyer subscribed again. */
async function boughtAgainSince(tx: Transaction, email: string, since: Date) {
  const [purchase] = await tx
    .select({ id: adminAuditLog.id })
    .from(adminAuditLog)
    .where(
      and(
        eq(adminAuditLog.actorEmail, hotmartActor),
        eq(adminAuditLog.targetEmail, email),
        eq(adminAuditLog.action, "access.granted"),
        gt(adminAuditLog.createdAt, since),
      ),
    )
    .limit(1);
  return purchase != null;
}

/** The last paid day of a cancelled subscription arrived: access ends unless the buyer subscribed again. */
export async function endCancelledSubscription(job: { email: string; subscription: string; cancelledAt: Date }) {
  await db.transaction(async (tx) => {
    await lockBuyer(tx, job.email);
    if (await boughtAgainSince(tx, job.email, job.cancelledAt))
      return auditHotmart(tx, "access.end_skipped", job.email, { subscription: job.subscription });
    await revokeBuyerAccess(tx, job.email, hotmartBlockReasons.SUBSCRIPTION_CANCELLATION, { subscription: job.subscription });
  });
}
