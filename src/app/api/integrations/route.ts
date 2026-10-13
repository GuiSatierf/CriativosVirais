import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { handle, apiTenant, readJson, json } from "@/lib/http";
import { encrypt, newSecret, tokenHash } from "@/lib/crypto";
import { utmifyCredentials } from "@/lib/connectors/utmify";
import { getJobs } from "@/jobs";
const schema = z.discriminatedUnion("provider", [
  utmifyCredentials.extend({ provider: z.literal("utmify") }),
  z.object({ provider: z.literal("webhook") }),
]);
export function GET(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    return json(
      await db
        .select({
          provider: integrations.provider,
          status: integrations.status,
          lastSyncAt: integrations.lastSyncAt,
          metadata: integrations.metadata,
        })
        .from(integrations)
        .where(eq(integrations.tenantId, tenantId)),
    );
  });
}
export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(request, schema);
    if (input.provider === "webhook") {
      const token = newSecret(),
        secret = newSecret();
      const values = {
        tenantId,
        provider: "webhook" as const,
        tokenHash: tokenHash(token),
        webhookSecretEncrypted: encrypt(secret),
        credentialsEncrypted: null,
        status: "connected",
      };
      await db
        .insert(integrations)
        .values(values)
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.provider],
          set: values,
        });
      return json({
        url: process.env.BETTER_AUTH_URL + "/api/ingest/events",
        token,
        secret,
      });
    }
    const values = {
      tenantId,
      provider: "utmify" as const,
      credentialsEncrypted: encrypt(
        JSON.stringify(utmifyCredentials.parse(input)),
      ),
      status: "pending",
      metadata: null,
    };
    const [row] = await db
      .insert(integrations)
      .values(values)
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: values,
      })
      .returning({ id: integrations.id });
    const boss = await getJobs();
    await boss.send(
      "sync-metrics",
      { tenantId, integrationId: row.id },
      { singletonKey: row.id },
    );
    return json({ saved: true }, 202);
  });
}
export function DELETE(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const input = await readJson(
      request,
      z.object({ provider: z.enum(["utmify", "webhook"]) }).strict(),
    );
    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, input.provider),
        ),
      );
    return json({ disconnected: true });
  });
}
