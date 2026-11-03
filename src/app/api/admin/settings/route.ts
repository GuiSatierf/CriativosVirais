import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { saveAccessEndPolicy, saveAiMonthlyLimit, saveHotmartSettings } from "@/lib/app-settings";
import { accessEndPolicy } from "@/db/schema";
import { handle, json, readJson } from "@/lib/http";

const maxHotmartProducts = 20;
const minAiLimitCents = 100;
const maxAiLimitCents = 1_000_000;

// Hotmart product ids are numbers; the panel sends them as typed, separated by commas.
const productIdsSchema = z
  .string()
  .max(500)
  .transform((value) => value.split(",").map((id) => id.trim()).filter((id) => id.length > 0))
  .pipe(z.array(z.string().regex(/^\d{1,20}$/)).min(1).max(maxHotmartProducts));

const settingsSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("hotmart"),
    // Blank keeps the saved hottok; it is never sent back to the browser to be resent.
    hottok: z
      .string()
      .trim()
      .regex(/^(\S{8,200})?$/)
      .transform((value) => (value.length === 0 ? null : value)),
    productIds: productIdsSchema,
  }),
  z.object({
    section: z.literal("ai-limit"),
    cents: z.number().int().min(minAiLimitCents).max(maxAiLimitCents),
  }),
  z.object({
    section: z.literal("access-end"),
    policy: z.enum(accessEndPolicy.enumValues),
  }),
]);

/** Owner-only platform settings, one section per save. */
export function PUT(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-settings");
    const input = await readJson(request, settingsSchema, 4_000);
    if (input.section === "hotmart") await saveHotmartSettings(actor, input);
    if (input.section === "ai-limit") await saveAiMonthlyLimit(actor, input.cents);
    if (input.section === "access-end") await saveAccessEndPolicy(actor, input.policy);
    return json({ saved: true });
  });
}
