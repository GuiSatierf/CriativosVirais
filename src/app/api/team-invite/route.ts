import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, json, readJson, requireSameOrigin } from "@/lib/http";
import { applyTeamInvite } from "@/lib/team-invites";
import { teamInviteTokenSchema } from "@/lib/team-invite-token";

const acceptSchema = z.object({ token: teamInviteTokenSchema });

/** Someone who already had an account accepts a team invite: the emailed secret plus their own sign-in. */
export function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const { token } = await readJson(request, acceptSchema, 1_000);
    const current = await getAuth().api.getSession({ headers: request.headers });
    if (current == null) throw new HttpError(401, "Entre na sua conta.");
    // A support visit uses the client's session; only the client can accept for themselves.
    const { impersonatedBy } = current.session as { impersonatedBy?: string | null };
    if (impersonatedBy != null) throw new HttpError(403, "Indisponível no acesso do suporte.");
    return json({ joined: await applyTeamInvite(current.user, token) });
  });
}
