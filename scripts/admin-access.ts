import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { accessGrants, adminAuditLog, session, twoFactor, user } from "../src/db/schema";

/**
 * Operator commands on the server, the only way to create the first admins:
 *   node dist/tools/scripts/admin-access.js grant <email> [note]
 *   node dist/tools/scripts/admin-access.js make-admin <email>
 *   node dist/tools/scripts/admin-access.js remove-admin <email>
 *   node dist/tools/scripts/admin-access.js reset-two-factor <email>
 * make-admin needs an existing account (grant, then sign up, then make-admin). reset-two-factor is
 * for an admin who lost both the authenticator and the recovery codes: they enroll again.
 */
const [command, rawEmail, ...noteParts] = process.argv.slice(2);
const operator = "linha de comando do servidor";

function usage(): never {
  throw new Error("Use: grant <email> [observação] | make-admin <email> | remove-admin <email> | reset-two-factor <email>");
}

async function audit(action: string, email: string, details: Record<string, string> = {}) {
  await db.insert(adminAuditLog).values({ actorEmail: operator, action, targetEmail: email, details });
}

async function grant(email: string) {
  const note = noteParts.join(" ").trim();
  const [created] = await db
    .insert(accessGrants)
    .values({ email, note: note.length > 0 ? note : null })
    .onConflictDoNothing({ target: accessGrants.email })
    .returning({ id: accessGrants.id });
  if (created == null) return console.info(`${email} já tinha acesso.`);
  await audit("access.granted", email, note.length > 0 ? { note } : {});
  console.info(`Acesso liberado para ${email}.`);
}

async function setRole(email: string, role: "admin" | "user") {
  const updated = await db
    .update(user)
    .set({ role })
    .where(sql`lower(${user.email}) = ${email}`)
    .returning({ id: user.id });
  if (updated.length === 0) throw new Error(`Nenhuma conta com ${email}. Libere o acesso e crie a conta antes.`);
  await audit(role === "admin" ? "admin.granted" : "admin.removed", email);
  if (role === "user") return console.info(`${email} não é mais admin.`);
  // Until two-factor is on, the password alone opens enrollment: whoever has it could enroll first.
  console.info(`${email} agora é admin. Peça para a pessoa entrar em /admin AGORA e ativar as duas etapas.`);
}

async function resetTwoFactor(email: string) {
  const [account] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`);
  if (account == null) throw new Error(`Nenhuma conta com ${email}.`);
  await db.delete(twoFactor).where(sql`${twoFactor.userId} = ${account.id}`);
  await db.update(user).set({ twoFactorEnabled: false }).where(sql`${user.id} = ${account.id}`);
  // Signed out everywhere, so the next sign-in goes straight to a new enrollment.
  await db.delete(session).where(sql`${session.userId} = ${account.id}`);
  await audit("two_factor.reset", email);
  console.info(`Duas etapas zeradas para ${email}. A pessoa entra com a senha e ativa de novo em /admin, na hora.`);
}

async function main() {
  if (rawEmail == null || rawEmail.trim().length === 0) usage();
  const email = rawEmail.trim().toLowerCase();
  try {
    if (command === "grant") return await grant(email);
    if (command === "make-admin") return await setRole(email, "admin");
    if (command === "remove-admin") return await setRole(email, "user");
    if (command === "reset-two-factor") return await resetTwoFactor(email);
    usage();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Não foi possível concluir.");
  process.exitCode = 1;
});
