import { z } from "zod";
import { requireAdmin, userIdSchema } from "@/lib/admin";
import { changeTeamRole, removeTeamMember } from "@/lib/admin-team";
import { handle, json, readJson } from "@/lib/http";
import { staffRoles } from "@/lib/staff";

const roleSchema = z.object({ role: z.enum(staffRoles) });

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-team");
    const userId = userIdSchema.parse((await context.params).id);
    const { role } = await readJson(request, roleSchema, 1_000);
    await changeTeamRole(actor, userId, role);
    return json({ role });
  });
}

/** Takes the person off the team; their own client account stays. */
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-team");
    const userId = userIdSchema.parse((await context.params).id);
    await removeTeamMember(actor, userId);
    return json({ removed: true });
  });
}
