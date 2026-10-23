import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { listAccounts } from "@/lib/admin-accounts";
import { handle, json } from "@/lib/http";

const querySchema = z.string().trim().max(254);

/** Client accounts for the Contas tab, searched by name or email. */
export function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request, "enter-accounts");
    const query = querySchema.parse(new URL(request.url).searchParams.get("q") ?? "");
    return json({ accounts: await listAccounts(query) });
  });
}
