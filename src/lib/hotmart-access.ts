import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessGrants, adminAuditLog, user } from "@/db/schema";
import { getJobs } from "@/jobs";
import { normalizeEmail } from "./access";
import { sendAccessInvite } from "./access-invite-email";
import { hotmartAccessConfig, subscriptionEndPolicy } from "./app-settings";
import { sameHottok } from "./connectors/hotmart";
import { HttpError } from "./errors";
import {
  auditHotmart,
  findBuyerAccount,
  hotmartActor,
  hotmartBlockReasons,
  isHotmartBlock,
  lockBuyer,
  revokeBuyerAccess,
  type Transaction,
} from "./hotmart-blocks";

const grantingEvents = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const reversalReasons: Record<string, string> = {
  PURCHASE_REFUNDED: hotmartBlockReasons.PURCHASE_REFUNDED,
  PURCHASE_CHARGEBACK: hotmartBlockReasons.PURCHASE_CHARGEBACK,
};

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

// A cancelled subscription keeps access until date_next_charge, the last paid day, in milliseconds.
const cancellationEventSchema = z.object({
  id: z.string().min(1).max(200),
  event: z.literal("SUBSCRIPTION_CANCELLATION"),
  data: z.object({
    product: z.object({ id: z.union([z.number().int(), z.string()]) }),
    subscriber: z.object({ email: z.email().max(254) }),
    subscription: z.object({ id: z.union([z.number().int(), z.string().trim().min(1).max(100)]) }),
    date_next_charge: z.number().int().positive().nullish(),
  }),
});
export type HotmartCancellationEvent = z.infer<typeof cancellationEventSchema>;

/** Only the Hotmart account that sells this app may change access; the panel's settings win over the server's. */
export async function requireHotmart(hottok: string | null) {
  const config = await hotmartAccessConfig();
  if (config == null) throw new HttpError(404, "Não encontrado.");
  if (!sameHottok(hottok, config.hottok)) throw new HttpError(401, "Credencial inválida.");
  return config;
}

/** Null for anything that is not a purchase event; Hotmart retries every non-2xx answer forever. */
export function parsePurchaseEvent(body: unknown) {
  return purchaseEventSchema.safeParse(body).data ?? null;
}

/** Hotmart may deliver an old approval after the refund of the same purchase; it must not undo it. */
async function wasReversed(tx: Transaction, email: string, transaction: string) {
  const [reversal] = await tx
    .select({ id: adminAuditLog.id })
    .from(adminAuditLog)
    .where(
      and(
        eq(adminAuditLog.actorEmail, hotmartActor),
        eq(adminAuditLog.targetEmail, email),
        inArray(adminAuditLog.action, ["account.blocked", "access.removed", "access.revoked"]),
        sql`${adminAuditLog.details}->>'transaction' = ${transaction}`,
      ),
    )
    .limit(1);
  return reversal != null;
}

/** A purchase frees the email to sign up and lifts a block that a past refund put on it. */
/** Records the grant; true when a new buyer without an account should get the invite email. */
async function grant(tx: Transaction, email: string, transaction: string) {
  if (await wasReversed(tx, email, transaction)) {
    await auditHotmart(tx, "access.grant_skipped", email, { transaction });
    return false;
  }
  const [created] = await tx
    .insert(accessGrants)
    .values({ email, source: "hotmart", note: `Hotmart ${transaction}` })
    .onConflictDoNothing({ target: accessGrants.email })
    .returning({ id: accessGrants.id });
  const account = await findBuyerAccount(tx, email);
  if (account?.banned === true && isHotmartBlock(account.banReason))
    await tx.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, account.id));
  await auditHotmart(tx, "access.granted", email, { transaction });
  // Repeated deliveries and existing accounts get nothing; only a new buyer learns where to sign up.
  return created != null && account == null;
}

/** Applies one purchase event; anything that is not a sale or a reversal of this product is ignored. */
export async function applyPurchaseEvent(event: HotmartPurchaseEvent | null, productIds: readonly string[]) {
  if (event == null) return "ignored";
  if (!productIds.includes(String(event.data.product.id))) return "ignored";
  const email = normalizeEmail(event.data.buyer.email);
  const transaction = event.data.purchase.transaction;
  const reason = reversalReasons[event.event] ?? null;
  if (!grantingEvents.has(event.event) && reason == null) return "ignored";
  const outcome = await db.transaction(async (tx) => {
    await lockBuyer(tx, email);
    if (reason == null) return { result: "granted" as const, invite: await grant(tx, email, transaction) };
    await revokeBuyerAccess(tx, email, reason, { transaction });
    return { result: "revoked" as const, invite: false };
  });
  // Sent only after the grant is committed, and not awaited: the sender logs its own failures.
  if (outcome.invite) void sendAccessInvite(email);
  return outcome.result;
}

/** Null for anything that is not a subscription cancellation. */
export function parseCancellationEvent(body: unknown) {
  return cancellationEventSchema.safeParse(body).data ?? null;
}

/** The worker blocks the account on the last paid day, unless the buyer subscribes again before it. */
async function scheduleAccessEnd(email: string, subscription: string, endsAt: Date) {
  const cancelledAt = new Date().toISOString();
  await (await getJobs()).send("hotmart-access-end", { email, subscription, cancelledAt }, { startAfter: endsAt });
  await db.insert(adminAuditLog).values({
    actorEmail: hotmartActor,
    action: "access.end_scheduled",
    targetEmail: email,
    details: { subscription, endsAt: endsAt.toISOString() },
  });
}

/**
 * Takes access away now, or, when the owner chose to keep it until the paid period ends, has the
 * worker take it away on the last paid day. Refunds and chargebacks always block at once.
 */
export async function applyCancellationEvent(event: HotmartCancellationEvent, productIds: readonly string[]) {
  if (!productIds.includes(String(event.data.product.id))) return "ignored";
  const email = normalizeEmail(event.data.subscriber.email);
  const subscription = String(event.data.subscription.id);
  const endsAt = event.data.date_next_charge == null ? null : new Date(event.data.date_next_charge);
  const keepsPaidPeriod = (await subscriptionEndPolicy()) === "end_of_period" && endsAt != null && endsAt > new Date();
  if (keepsPaidPeriod) {
    await scheduleAccessEnd(email, subscription, endsAt);
    return "scheduled";
  }
  await db.transaction(async (tx) => {
    await lockBuyer(tx, email);
    await revokeBuyerAccess(tx, email, hotmartBlockReasons.SUBSCRIPTION_CANCELLATION, { subscription });
  });
  return "revoked";
}
