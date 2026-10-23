import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { cancelTeamInvite } from "@/lib/admin-team";
import { handle, json, readJson } from "@/lib/http";

const cancelSchema = z.object({ email: z.email().max(254) });

/** Cancels an invite nobody used yet; the freed email stays in Acessos. */
export function DELETE(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-team");
    const { email } = await readJson(request, cancelSchema, 1_000);
    await cancelTeamInvite(actor, email);
    return json({ cancelled: true });
  });
}
