import { z } from "zod";
import { requireAdmin, userIdSchema } from "@/lib/admin";
import { changeClientEmail } from "@/lib/admin-accounts";
import { handle, json, readJson } from "@/lib/http";

const emailSchema = z.object({ email: z.email().max(254) });

/** The client signs in with the new email from now on. */
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "enter-accounts");
    const userId = userIdSchema.parse((await context.params).id);
    const { email } = await readJson(request, emailSchema, 1_000);
    await changeClientEmail(actor, userId, email);
    return json({ saved: true });
  });
}
