import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";
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
import { isClientOnlyPath, isStaffRole, staffRoles } from "./staff";
import { legalVersion, legalVersionHeader } from "./legal";
import { recordAccess, recordTermsAcceptance } from "./legal-records";
import { applyTeamInvite } from "./team-invites";

const noAccessMessage =
  "Este e-mail ainda não tem acesso. Use o e-mail da compra na Hotmart. Se já comprou, fale com o suporte.";

/** Only granted emails sign up; the plugin's admin endpoints are reachable only from server code. */
const accessRules = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-up/email") {
    requireTermsAcceptance(ctx);
    const email: unknown = ctx.body?.email;
    if (typeof email === "string" && (await hasAccessGrant(email))) return;
    throw new APIError("FORBIDDEN", { message: noAccessMessage, code: "NO_ACCESS_GRANT" });
  }
  // Admin actions go through /api/admin, which checks two-factor and writes the audit log.
  if (ctx.path.startsWith("/admin/") && ctx.request)
    throw new APIError("NOT_FOUND", { message: "Não encontrado." });
  if (twoFactorEnrollment.has(ctx.path)) await requireEnrollmentCode(ctx);
  if (isClientOnlyPath(ctx.path)) await refuseWhileInsideClientAccount(ctx);
  if (ctx.path === "/delete-user") requireDeletionPassword(ctx.body?.password);
});

// Browser sign-ups must carry the accepted terms version; server code (the demo seed) signs up directly.
function requireTermsAcceptance(ctx: { request?: Request; headers?: Headers }) {
  if (ctx.request == null) return;
  if (ctx.headers?.get(legalVersionHeader) === String(legalVersion)) return;
  throw new APIError("BAD_REQUEST", { message: "Aceite os termos para continuar.", code: "TERMS_NOT_ACCEPTED" });
}

// Better Auth deletes a fresh session's account without a password; this app always
// demands it, so a session left open on another device cannot erase the account.
function requireDeletionPassword(password: unknown) {
  if (typeof password === "string" && password.length > 0) return;
  throw new APIError("BAD_REQUEST", { message: "Digite sua senha para excluir a conta." });
}

// A staff member inside a client's account helps with the work, never with the client's credentials.
async function refuseWhileInsideClientAccount(ctx: Parameters<typeof getSessionFromCtx>[0]) {
  const session = await getSessionFromCtx(ctx);
  const impersonatedBy = (session?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy;
  if (impersonatedBy == null) return;
  throw new APIError("FORBIDDEN", {
    message: "Indisponível no acesso do suporte. Só o próprio cliente pode fazer isso.",
    code: "CLIENT_ONLY_ACTION",
  });
}

// Plugin permissions per team role: everyone on the team may enter a client's account and set its
// password; only owners and admins manage users. Team members themselves can never be entered.
const supportAc = defaultAc.newRole({ user: ["impersonate", "set-password"], session: [] });
const roles = { owner: adminAc, admin: adminAc, support: supportAc, user: userAc };

// A team member without two-factor enrolls (or resumes enrolling) only with the operator's one-time code.
const twoFactorEnrollment = new Set(["/two-factor/enable", "/two-factor/get-totp-uri"]);
async function requireEnrollmentCode(ctx: Parameters<typeof getSessionFromCtx>[0]) {
  const session = await getSessionFromCtx(ctx);
  if (session == null) return;
  const { id, role, twoFactorEnabled } = session.user as { id: string; role?: string | null; twoFactorEnabled?: boolean | null };
  if (!isStaffRole(role) || twoFactorEnabled === true) return;
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
            // Sign-up was refused above unless the person accepted the current terms.
            await recordTermsAcceptance(user.id);
            // Someone the owner added to the team before they had an account.
            await applyTeamInvite(user);
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await recordAccess(session);
          },
        },
      },
    },
    hooks: { before: accessRules },
    plugins: [
      admin({
        roles,
        adminRoles: [...staffRoles],
        // Time a team member stays inside a client's account before signing back in.
        impersonationSessionDuration: 60 * 60,
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
