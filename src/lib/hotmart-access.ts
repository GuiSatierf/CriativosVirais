import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessGrants, adminAuditLog, session, user } from "@/db/schema";
import { normalizeEmail } from "./access";
import { sameHottok } from "./connectors/hotmart";
import { hotmartEnv } from "./env";
import { HttpError } from "./errors";

const actor = "Hotmart";
const blockReasons = {
  PURCHASE_REFUNDED: "compra reembolsada na Hotmart",
  PURCHASE_CHARGEBACK: "chargeback da compra na Hotmart",
} as const;
const grantingEvents = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);

// Only the fields this app uses; Hotmart sends many more and adds new ones over time.
const purchaseEventSchema = z.object({
  id: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
  data: z.object({
    product: z.object({ id: z.union([z.number().int(), z.string()]) }),
    buyer: z.object({ email: z.email().max(254) }),
    // The transaction links a refund to its approval; an event without it cannot be trusted.
    purchase: z.object({ transaction: z.string().trim().min(1).max(100) }),
  }),
});
export type HotmartPurchaseEvent = z.infer<typeof purchaseEventSchema>;

/** Only the Hotmart account that sells this app may change access. */
export function requireHotmart(hottok: string | null) {
  const config = hotmartEnv();
  if (config == null) throw new HttpError(404, "Não encontrado.");
  if (!sameHottok(hottok, config.HOTMART_HOTTOK)) throw new HttpError(401, "Credencial inválida.");
  return config;
}

/** Null for anything that is not a purchase event; Hotmart retries every non-2xx answer forever. */
export function parsePurchaseEvent(body: unknown) {
  return purchaseEventSchema.safeParse(body).data ?? null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function audit(tx: Transaction, action: string, email: string, details: Record<string, string>) {
  await tx.insert(adminAuditLog).values({ actorEmail: actor, action, targetEmail: email, details });
}

async function findAccount(tx: Transaction, email: string) {
  const [account] = await tx
    .select({ id: user.id, role: user.role, banned: user.banned, banReason: user.banReason })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`);
  return account ?? null;
}

const hotmartBlocks: readonly string[] = Object.values(blockReasons);

/** Hotmart may deliver an old approval after the refund of the same purchase; it must not undo it. */
async function wasReversed(tx: Transaction, email: string, transaction: string) {
  const [reversal] = await tx
    .select({ id: adminAuditLog.id })
    .from(adminAuditLog)
    .where(
      and(
        eq(adminAuditLog.actorEmail, actor),
        eq(adminAuditLog.targetEmail, email),
        inArray(adminAuditLog.action, ["account.blocked", "access.removed", "access.revoked"]),
        sql`${adminAuditLog.details}->>'transaction' = ${transaction}`,
      ),
    )
    .limit(1);
  return reversal != null;
}

/** A purchase frees the email to sign up and lifts a block that a past refund put on it. */
async function grant(tx: Transaction, email: string, transaction: string) {
  if (await wasReversed(tx, email, transaction)) return audit(tx, "access.grant_skipped", email, { transaction });
  await tx
    .insert(accessGrants)
    .values({ email, source: "hotmart", note: `Hotmart ${transaction}` })
    .onConflictDoNothing({ target: accessGrants.email });
  const account = await findAccount(tx, email);
  if (account?.banned === true && account.banReason != null && hotmartBlocks.includes(account.banReason))
    await tx.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, account.id));
  await audit(tx, "access.granted", email, { transaction });
}

/** A refund or chargeback takes access away; a team account is never touched from outside. */
async function revoke(tx: Transaction, email: string, reason: string, transaction: string) {
  const account = await findAccount(tx, email);
  if (account == null) {
    await tx.delete(accessGrants).where(and(eq(accessGrants.email, email), eq(accessGrants.source, "hotmart")));
    return audit(tx, "access.removed", email, { reason, transaction });
  }
  // Any role other than a plain client is the team (admin today, owner and support later).
  const onTeam = account.role != null && account.role !== "user";
  if (onTeam) return audit(tx, "access.revoke_skipped", email, { reason, transaction });
  // A block the team put on the account keeps its reason, so a later purchase cannot lift it.
  const blockedByTeam = account.banned === true && (account.banReason == null || !hotmartBlocks.includes(account.banReason));
  if (blockedByTeam) return audit(tx, "access.revoked", email, { reason, transaction });
  await tx.update(user).set({ banned: true, banReason: reason, banExpires: null }).where(eq(user.id, account.id));
  await tx.delete(session).where(eq(session.userId, account.id));
  await audit(tx, "account.blocked", email, { reason, transaction });
}

/** Applies one purchase event; anything that is not a sale or a reversal of this product is ignored. */
export async function applyPurchaseEvent(event: HotmartPurchaseEvent | null, productIds: readonly string[]) {
  if (event == null) return "ignored";
  if (!productIds.includes(String(event.data.product.id))) return "ignored";
  const email = normalizeEmail(event.data.buyer.email);
  const transaction = event.data.purchase.transaction;
  const reason = event.event in blockReasons ? blockReasons[event.event as keyof typeof blockReasons] : null;
  if (!grantingEvents.has(event.event) && reason == null) return "ignored";
  return db.transaction(async (tx) => {
    // Hotmart may deliver an approval and its refund at the same time; one buyer's events run one at a time.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 3))`);
    if (reason == null) {
      await grant(tx, email, transaction);
      return "granted" as const;
    }
    await revoke(tx, email, reason, transaction);
    return "revoked" as const;
  });
}
