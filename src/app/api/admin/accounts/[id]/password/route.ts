import { z } from "zod";
import { requireAdmin, userIdSchema } from "@/lib/admin";
import { setClientPassword } from "@/lib/admin-accounts";
import { handle, json, readJson } from "@/lib/http";
import { newPasswordSchema } from "@/lib/password-rules";

const passwordSchema = z.object({ password: newPasswordSchema });

/** A new password chosen with the client; it is never stored in the audit log. */
export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "enter-accounts");
    const userId = userIdSchema.parse((await context.params).id);
    const { password } = await readJson(request, passwordSchema, 1_000);
    await setClientPassword(actor, request.headers, userId, password);
    return json({ saved: true });
  });
}
