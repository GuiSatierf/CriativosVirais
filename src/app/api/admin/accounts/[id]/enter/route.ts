import { z } from "zod";
import { requireAdmin, userIdSchema } from "@/lib/admin";
import { enterAccount } from "@/lib/admin-accounts";
import { handle, json, readJson } from "@/lib/http";

const enterSchema = z.object({ reason: z.string().trim().min(3).max(200) });

/** Opens the client's account for one hour; the reason goes to the audit log. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request, "enter-accounts");
    const userId = userIdSchema.parse((await context.params).id);
    const { reason } = await readJson(request, enterSchema, 2_000);
    const cookies = await enterAccount(actor, request.headers, userId, reason);
    const response = json({ entered: true });
    for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
    return response;
  });
}
