import { z } from "zod";
import { grantAccess, listAccess, requireAdmin } from "@/lib/admin";
import { handle, json, readJson } from "@/lib/http";

const grantSchema = z.object({
  email: z.email().max(254),
  note: z.string().trim().max(200).nullable().optional(),
});

const listSchema = z.object({
  q: z.string().trim().max(254).default(""),
  situacao: z.enum(["waiting", "active", "blocked"]).nullable().default(null),
});

/** Emails allowed to create an account, with the state of each account, searched by email and status. */
export function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const filter = listSchema.parse({ q: params.get("q") ?? undefined, situacao: params.get("situacao") });
    return json(await listAccess(filter.q, filter.situacao));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireAdmin(request);
    const input = await readJson(request, grantSchema, 4_000);
    const note = input.note == null || input.note.length === 0 ? null : input.note;
    await grantAccess(actor, input.email, note);
    return json({ granted: true }, 201);
  });
}
