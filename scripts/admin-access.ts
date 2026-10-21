import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { accessGrants, adminAuditLog, user } from "../src/db/schema";

/**
 * Operator commands on the server, the only way to create the first admins:
 *   node dist/tools/scripts/admin-access.js grant <email> [note]
 *   node dist/tools/scripts/admin-access.js make-admin <email>
 *   node dist/tools/scripts/admin-access.js remove-admin <email>
 * make-admin needs an existing account (grant, then sign up, then make-admin).
 */
const [command, rawEmail, ...noteParts] = process.argv.slice(2);
const operator = "linha de comando do servidor";

function usage(): never {
  throw new Error("Use: grant <email> [observação] | make-admin <email> | remove-admin <email>");
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
  console.info(role === "admin" ? `${email} agora é admin. No primeiro acesso a /admin, ativa as duas etapas.` : `${email} não é mais admin.`);
}

async function main() {
  if (rawEmail == null || rawEmail.trim().length === 0) usage();
  const email = rawEmail.trim().toLowerCase();
  try {
    if (command === "grant") return await grant(email);
    if (command === "make-admin") return await setRole(email, "admin");
    if (command === "remove-admin") return await setRole(email, "user");
    usage();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Não foi possível concluir.");
  process.exitCode = 1;
});
