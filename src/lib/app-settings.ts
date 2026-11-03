import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accessEndPolicy, adminAuditLog, appSettings } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";
import { aiBudgetEnv, authEnv, hotmartEnv } from "./env";
import { HttpError } from "./errors";

// Settings the owner changes in the panel. Each one falls back to the server environment until it is saved.
const settingsRowId = 1;
export type AccessEndPolicy = (typeof accessEndPolicy.enumValues)[number];
export type SettingsActor = { id: string; email: string };

async function readSettings() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, settingsRowId));
  return row ?? null;
}

/** The hottok and products the purchase webhook accepts; null while neither the panel nor the server set them. */
export async function hotmartAccessConfig() {
  const row = await readSettings();
  if (row?.hotmartHottok != null && row.hotmartProductIds != null)
    return { hottok: decrypt(row.hotmartHottok), productIds: row.hotmartProductIds };
  const fromServer = hotmartEnv();
  if (fromServer == null) return null;
  return { hottok: fromServer.HOTMART_HOTTOK, productIds: fromServer.HOTMART_PRODUCT_IDS };
}

type SettingsRow = Awaited<ReturnType<typeof readSettings>>;

function limitCentsOf(row: SettingsRow) {
  return row?.aiMonthlyLimitCents ?? BigInt(aiBudgetEnv().AI_MONTHLY_LIMIT_CENTS);
}

/** Monthly AI spend allowed per client, in BRL cents. */
export async function aiMonthlyLimitCents() {
  return limitCentsOf(await readSettings());
}

export async function subscriptionEndPolicy(): Promise<AccessEndPolicy> {
  return (await readSettings())?.accessEndPolicy ?? "immediate";
}

/** What the Configurações tab shows; the hottok itself never leaves the server. */
export async function settingsForPanel() {
  const row = await readSettings();
  const fromServer = hotmartEnv();
  const savedInPanel = row?.hotmartHottok != null;
  return {
    hotmart: {
      configured: savedInPanel || fromServer != null,
      hasHottok: savedInPanel,
      productIds: row?.hotmartProductIds ?? fromServer?.HOTMART_PRODUCT_IDS ?? [],
      webhookUrl: new URL("/api/hotmart/access", authEnv().BETTER_AUTH_URL).toString(),
    },
    aiMonthlyLimitCents: Number(limitCentsOf(row)),
    accessEndPolicy: row?.accessEndPolicy ?? ("immediate" as const),
  };
}

type SettingsChange = Partial<Omit<typeof appSettings.$inferInsert, "id" | "updatedAt">>;

/** Saves one part of the settings and records who changed it; details never carry the hottok. */
async function saveSettings(actor: SettingsActor, change: SettingsChange, action: string, details: Record<string, string>) {
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ id: settingsRowId, ...change })
      .onConflictDoUpdate({ target: appSettings.id, set: { ...change, updatedAt: new Date() } });
    await tx.insert(adminAuditLog).values({ actorUserId: actor.id, actorEmail: actor.email, action, details });
  });
}

/** A blank hottok keeps the one already saved; the first save must bring one. */
export async function saveHotmartSettings(actor: SettingsActor, input: { hottok: string | null; productIds: string[] }) {
  const current = await readSettings();
  if (input.hottok == null && current?.hotmartHottok == null) throw new HttpError(400, "Cole o hottok da Hotmart.");
  const hottok = input.hottok == null ? {} : { hotmartHottok: encrypt(input.hottok) };
  await saveSettings(actor, { ...hottok, hotmartProductIds: input.productIds }, "settings.hotmart_changed", {
    productIds: input.productIds.join(", "),
    hottok: input.hottok == null ? "mantido" : "trocado",
  });
}

export async function saveAiMonthlyLimit(actor: SettingsActor, cents: number) {
  await saveSettings(actor, { aiMonthlyLimitCents: BigInt(cents) }, "settings.ai_limit_changed", { cents: String(cents) });
}

export async function saveAccessEndPolicy(actor: SettingsActor, policy: AccessEndPolicy) {
  await saveSettings(actor, { accessEndPolicy: policy }, "settings.access_end_changed", { policy });
}
