import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { addTeamMember, listTeam } from "@/lib/admin-team";
import { handle, json, readJson } from "@/lib/http";
import { staffRoles } from "@/lib/staff";

const addSchema = z.object({ email: z.email().max(254), role: z.enum(staffRoles) });

/** The owner's view of the team: roles and two-factor status. */
export function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request, "manage-team");
    return json({ team: await listTeam() });
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin(request, "manage-team");
    const { email, role } = await readJson(request, addSchema, 2_000);
    return json(await addTeamMember(actor, email, role), 201);
  });
}
