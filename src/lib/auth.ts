import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { user, session, account, verification, rateLimit } from "@/db/schema";
import { authEnv } from "./env";
import { provisionTenant } from "./provision-tenant";
function createAuth() {
  const env = authEnv();
  return betterAuth({
    appName: "Criativos Virais",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await provisionTenant(user);
          },
        },
      },
    },
    // Persist limits in Postgres so app replicas do not reset their counters independently.
    rateLimit: { enabled: true, storage: "database" },
    logger: { disabled: true },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
