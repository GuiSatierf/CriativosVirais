import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
async function main() {
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
