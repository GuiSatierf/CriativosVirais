import { requireAdmin, userIdSchema } from "@/lib/admin";
import { issueTeamCode } from "@/lib/admin-team";
import { handle, json } from "@/lib/http";

/** A new activation code for a team member who has not turned on two-factor yet. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-team");
    const userId = userIdSchema.parse((await context.params).id);
    return json(await issueTeamCode(actor, userId), 201);
  });
}
