import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { twoFactor as twoFactorPlugin } from "better-auth/plugins/two-factor";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { user, session, account, verification, rateLimit, twoFactor } from "@/db/schema";
import { authEnv } from "./env";
import { provisionTenant } from "./provision-tenant";
import { deleteAccountData } from "./account-deletion";
import { sendPasswordResetEmail } from "./password-reset-email";
import { maxPasswordLength, minPasswordLength, resetLinkLifetimeSeconds } from "./password-rules";
import { hasAccessGrant, removeAccessGrant } from "./access";
import { enrollmentHeader, isValidEnrollmentCode } from "./admin-enrollment";

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
  if (twoFactorEnrollment.has(ctx.path)) await requireEnrollmentCode(ctx);
  if (ctx.path === "/delete-user") requireDeletionPassword(ctx.body?.password);
});

// Better Auth deletes a fresh session's account without a password; this app always
// demands it, so a session left open on another device cannot erase the account.
function requireDeletionPassword(password: unknown) {
  if (typeof password === "string" && password.length > 0) return;
  throw new APIError("BAD_REQUEST", { message: "Digite sua senha para excluir a conta." });
}

// An admin without two-factor enrolls (or resumes enrolling) only with the operator's one-time code.
const twoFactorEnrollment = new Set(["/two-factor/enable", "/two-factor/get-totp-uri"]);
async function requireEnrollmentCode(ctx: Parameters<typeof getSessionFromCtx>[0]) {
  const session = await getSessionFromCtx(ctx);
  if (session == null) return;
  const { id, role, twoFactorEnabled } = session.user as { id: string; role?: string | null; twoFactorEnabled?: boolean | null };
  if (role !== "admin" || twoFactorEnabled === true) return;
  if (await isValidEnrollmentCode(id, ctx.headers?.get(enrollmentHeader) ?? null)) return;
  throw new APIError("FORBIDDEN", {
    message: "Código de ativação inválido ou vencido. Peça um novo a quem administra o servidor.",
    code: "INVALID_ENROLLMENT_CODE",
  });
}
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
          // A deleted account needs a new grant (a new purchase) to sign up again.
          await removeAccessGrant(user.email);
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
