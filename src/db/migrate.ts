import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { dbEnv } from "../lib/env";
import { createPool } from "./index";
async function main() {
  // Data migrations may legitimately run longer than the app's statement timeout.
  const pool = createPool(dbEnv().DATABASE_URL, { statementTimeoutMs: 0 });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Database migration failed. Check DATABASE_URL, connectivity and migration state.",
  );
  process.exitCode = 1;
});
