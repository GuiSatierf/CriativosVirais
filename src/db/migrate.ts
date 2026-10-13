import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Database migration failed. Check database connectivity and migration state.",
  );
  process.exitCode = 1;
});
