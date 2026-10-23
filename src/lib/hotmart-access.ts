import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessGrants, adminAuditLog, session, user } from "@/db/schema";
import { normalizeEmail } from "./access";
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
    purchase: z.object({ transaction: z.string().max(100).optional() }),
  }),
});
export type HotmartPurchaseEvent = z.infer<typeof purchaseEventSchema>;

/** Hotmart proves who it is only with the account's hottok; compared in constant time. */
export function requireHotmart(hottok: string | null) {
  const config = hotmartEnv();
  if (config == null) throw new HttpError(404, "Não encontrado.");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (hottok == null || !timingSafeEqual(digest(hottok), digest(config.HOTMART_HOTTOK)))
    throw new HttpError(401, "Credencial inválida.");
  return config;
}

export function parsePurchaseEvent(body: unknown) {
  const parsed = purchaseEventSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Dados inválidos.");
  return parsed.data;
}

async function audit(action: string, email: string, details: Record<string, string>) {
  await db.insert(adminAuditLog).values({ actorEmail: actor, action, targetEmail: email, details });
}

async function findAccount(email: string) {
  const [account] = await db
    .select({ id: user.id, role: user.role, banned: user.banned, banReason: user.banReason })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`);
  return account ?? null;
}

const hotmartBlocks: readonly string[] = Object.values(blockReasons);

/** A purchase frees the email to sign up and lifts a block that a past refund put on it. */
async function grant(email: string, transaction: string) {
  await db
    .insert(accessGrants)
    .values({ email, source: "hotmart", note: `Hotmart ${transaction}` })
    .onConflictDoNothing({ target: accessGrants.email });
  const account = await findAccount(email);
  if (account?.banned === true && account.banReason != null && hotmartBlocks.includes(account.banReason))
    await db.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, account.id));
  await audit("access.granted", email, { transaction });
}

/** A refund or chargeback takes access away; a team account is never touched from outside. */
async function revoke(email: string, reason: string, transaction: string) {
  const account = await findAccount(email);
  if (account == null) {
    await db.delete(accessGrants).where(and(eq(accessGrants.email, email), eq(accessGrants.source, "hotmart")));
    return audit("access.removed", email, { reason, transaction });
  }
  // Any role other than a plain client is the team (admin today, owner and support later).
  const onTeam = account.role != null && account.role !== "user";
  if (onTeam) return audit("access.revoke_skipped", email, { reason, transaction });
  await db.update(user).set({ banned: true, banReason: reason }).where(eq(user.id, account.id));
  await db.delete(session).where(eq(session.userId, account.id));
  await audit("account.blocked", email, { reason, transaction });
}

/** Applies one purchase event; anything that is not a sale or a reversal of this product is ignored. */
export async function applyPurchaseEvent(event: HotmartPurchaseEvent, productIds: readonly string[]) {
  if (!productIds.includes(String(event.data.product.id))) return "ignored";
  const email = normalizeEmail(event.data.buyer.email);
  const transaction = event.data.purchase.transaction ?? event.id;
  if (grantingEvents.has(event.event)) {
    await grant(email, transaction);
    return "granted";
  }
  if (event.event in blockReasons) {
    await revoke(email, blockReasons[event.event as keyof typeof blockReasons], transaction);
    return "revoked";
  }
  return "ignored";
}
