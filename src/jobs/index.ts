import { PgBoss } from "pg-boss";
export async function startJobs() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  // Never log job payloads or database errors containing credentials.
  boss.on("error", () => console.error("Job queue error"));
  await boss.start();
  return boss;
}
