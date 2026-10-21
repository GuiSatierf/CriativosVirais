import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { user, session, account, verification, rateLimit } from "@/db/schema";
import { authEnv } from "./env";
import { provisionTenant } from "./provision-tenant";
import { deleteAccountData } from "./account-deletion";
import { sendPasswordResetEmail } from "./password-reset-email";
import { maxPasswordLength, minPasswordLength, resetLinkLifetimeSeconds } from "./password-rules";
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
      minPasswordLength,
      maxPasswordLength,
      resetPasswordTokenExpiresIn: resetLinkLifetimeSeconds,
      // Whoever had the old password loses every open session once it changes.
      revokeSessionsOnPasswordReset: true,
      // Not awaited: waiting for Resend would make real accounts answer slower than unknown
      // emails and reveal which ones exist. The sender logs its own failures.
      sendResetPassword: async ({ user, url }) => {
        void sendPasswordResetEmail(user, url);
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await deleteAccountData(user.id);
        },
      },
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
    hooks: {
      // Better Auth deletes a fresh session's account without a password; this app always
      // demands it, so a session left open on another device cannot erase the account.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/delete-user") return;
        const password: unknown = ctx.body?.password;
        if (typeof password === "string" && password.length > 0) return;
        throw new APIError("BAD_REQUEST", { message: "Digite sua senha para excluir a conta." });
      }),
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
