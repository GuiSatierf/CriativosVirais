import { leaveAccount } from "@/lib/admin-accounts";
import { handle, json, requireSameOrigin } from "@/lib/http";

/** Leaves the client's account and restores the team member's own session. */
export function DELETE(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const cookies = await leaveAccount(request.headers);
    const response = json({ left: true });
    for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
    return response;
  });
}
