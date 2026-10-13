import { z } from "zod";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z
        .object({
          title: z.string().trim().min(1).max(200).default("Nova conversa"),
        })
        .strict(),
    );
    const [conversation] = await db
      .insert(conversations)
      .values({ tenantId, title: input.title })
      .returning({ id: conversations.id });
    return json(conversation, 201);
  });
}
