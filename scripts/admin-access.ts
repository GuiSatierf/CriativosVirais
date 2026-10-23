import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { accessGrants, adminAuditLog, session, twoFactor, user } from "../src/db/schema";
import { issueEnrollmentCode } from "../src/lib/admin-enrollment";
import { staffRoleLabel, type StaffRole } from "../src/lib/staff";

/**
 * Operator commands on the server, the only way to create the first owner (later owners manage the
 * team from the panel's Equipe tab):
 *   node dist/tools/scripts/admin-access.js grant <email> [note]
 *   node dist/tools/scripts/admin-access.js make-owner|make-admin|make-support <email>
 *   node dist/tools/scripts/admin-access.js remove-staff <email>
 *   node dist/tools/scripts/admin-access.js reset-two-factor <email>
 * make-* needs an existing account (grant, then sign up, then make-*). reset-two-factor is for a
 * team member who lost both the authenticator and the recovery codes: they enroll again.
 */
const [command, rawEmail, ...noteParts] = process.argv.slice(2);
const operator = "linha de comando do servidor";

function usage(): never {
  throw new Error(
    "Use: grant <email> [observação] | make-owner|make-admin|make-support <email> | remove-staff <email> | reset-two-factor <email>",
  );
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

async function setRole(email: string, role: StaffRole | null) {
  const updated = await db
    .update(user)
    .set({ role })
    .where(sql`lower(${user.email}) = ${email}`)
    .returning({ id: user.id });
  if (updated.length === 0) throw new Error(`Nenhuma conta com ${email}. Libere o acesso e crie a conta antes.`);
  await audit(role == null ? "team.removed" : "team.added", email, role == null ? {} : { role });
  if (role == null) return console.info(`${email} não faz mais parte da equipe.`);
  await printEnrollmentCode(updated[0].id, `${email} agora é ${staffRoleLabel[role]}.`);
}

/** The code goes to the new admin by a private channel; enrolling two-factor asks for it. */
async function printEnrollmentCode(userId: string, intro: string) {
  const code = await issueEnrollmentCode(userId);
  console.info(`${intro} Código de ativação (vale 24 horas, passe só para a pessoa): ${code}`);
  console.info("A pessoa entra, abre /admin e ativa as duas etapas com a senha e este código.");
}

async function resetTwoFactor(email: string) {
  const [account] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`);
  if (account == null) throw new Error(`Nenhuma conta com ${email}.`);
  await db.delete(twoFactor).where(sql`${twoFactor.userId} = ${account.id}`);
  await db.update(user).set({ twoFactorEnabled: false }).where(sql`${user.id} = ${account.id}`);
  // Signed out everywhere, so the next sign-in goes straight to a new enrollment.
  await db.delete(session).where(sql`${session.userId} = ${account.id}`);
  await audit("two_factor.reset", email);
  await printEnrollmentCode(account.id, `Duas etapas zeradas para ${email}.`);
}

async function main() {
  if (rawEmail == null || rawEmail.trim().length === 0) usage();
  const email = rawEmail.trim().toLowerCase();
  try {
    if (command === "grant") return await grant(email);
    if (command === "make-owner") return await setRole(email, "owner");
    if (command === "make-admin") return await setRole(email, "admin");
    if (command === "make-support") return await setRole(email, "support");
    if (command === "remove-staff" || command === "remove-admin") return await setRole(email, null);
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
