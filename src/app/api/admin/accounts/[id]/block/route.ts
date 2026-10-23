import { z } from "zod";
import { blockAccount, requireAdmin, unblockAccount, userIdSchema } from "@/lib/admin";
import { handle, json, readJson } from "@/lib/http";

const blockSchema = z.object({ reason: z.string().trim().min(3).max(200) });

/** Blocks the account; the client sees the reason when trying to sign in. */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request);
    const userId = userIdSchema.parse((await context.params).id);
    const { reason } = await readJson(request, blockSchema, 2_000);
    await blockAccount(actor, request.headers, userId, reason);
    return json({ blocked: true });
  });
}

export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireAdmin(request);
    const userId = userIdSchema.parse((await context.params).id);
    await unblockAccount(actor, request.headers, userId);
    return json({ blocked: false });
  });
}
