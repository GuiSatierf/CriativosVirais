import { z } from "zod";
import { removeAccess, requireAdmin } from "@/lib/admin";
import { handle, json } from "@/lib/http";

/** Removes a grant nobody used yet; an account already created is blocked instead. */
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "grant-access");
    const id = z.uuid().parse((await context.params).id);
    await removeAccess(actor, id);
    return json({ removed: true });
  });
}
