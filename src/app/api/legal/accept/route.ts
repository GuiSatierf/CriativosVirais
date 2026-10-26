import { getAuth } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, json, requireSameOrigin } from "@/lib/http";
import { recordTermsAcceptance } from "@/lib/legal-records";

/** The signed-in person accepts the current terms and privacy policy. */
export function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const current = await getAuth().api.getSession({ headers: request.headers });
    if (current == null) throw new HttpError(401, "Entre na sua conta para continuar.");
    // Only the client accepts; a team member inside the account cannot do it for them.
    if (current.session.impersonatedBy != null)
      throw new HttpError(403, "Só o próprio cliente pode aceitar os termos.");
    await recordTermsAcceptance(current.user.id);
    return json({ accepted: true });
  });
}
