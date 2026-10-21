import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { twoFactor as twoFactorPlugin } from "better-auth/plugins/two-factor";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { user, session, account, verification, rateLimit, twoFactor } from "@/db/schema";
import { authEnv } from "./env";
import { provisionTenant } from "./provision-tenant";
import { deleteAccountData } from "./account-deletion";
import { hasAccessGrant } from "./access";

const noAccessMessage =
  "Este e-mail ainda não tem acesso. Use o e-mail da compra na Hotmart. Se já comprou, fale com o suporte.";

/** Only granted emails sign up; the plugin's admin endpoints are reachable only from server code. */
const accessRules = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-up/email") {
    const email: unknown = ctx.body?.email;
    if (typeof email === "string" && (await hasAccessGrant(email))) return;
    throw new APIError("FORBIDDEN", { message: noAccessMessage, code: "NO_ACCESS_GRANT" });
  }
  // Admin actions go through /api/admin, which checks two-factor and writes the audit log.
  if (ctx.path.startsWith("/admin/") && ctx.request)
    throw new APIError("NOT_FOUND", { message: "Não encontrado." });
});
function createAuth() {
  const env = authEnv();
  return betterAuth({
    appName: "Criativos Virais",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit, twoFactor },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
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
    hooks: { before: accessRules },
    plugins: [
      admin({
        // Checked only after the password is right, so the reason never leaks to a guess.
        bannedUserMessage: (blocked) =>
          `Sua conta está bloqueada${blocked.banReason ? `: ${blocked.banReason}` : ""}. Para voltar a usar, fale com o suporte.`,
      }),
      twoFactorPlugin({ issuer: "Criativos Virais" }),
    ],
    // Persist limits in Postgres so app replicas do not reset their counters independently.
    rateLimit: { enabled: true, storage: "database" },
    logger: { disabled: true },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
