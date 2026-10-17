import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbEnv } from "../lib/env";
import { logError } from "../lib/log";
import * as schema from "./schema";

/**
 * Bounded pool: a dropped idle connection (database restart, network blip) is logged
 * instead of crashing the process, and connections and statements cannot hang forever.
 * Migrations pass statementTimeoutMs 0 because a long data migration is expected.
 */
export function createPool(connectionString: string, { statementTimeoutMs = 60_000 } = {}) {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ...(statementTimeoutMs ? { statement_timeout: statementTimeoutMs } : {}),
  });
  pool.on("error", (error) => logError("db-pool", error));
  return pool;
}
function connect() {
  const pool = createPool(dbEnv().DATABASE_URL);
  return { pool, db: drizzle(pool, { schema }) };
}
type Connection = ReturnType<typeof connect>;
let connection: Connection | undefined;

// Configuration is validated and the pool created on first use, so building the
// app requires no live database or credentials.
function lazy<K extends keyof Connection>(key: K) {
  const target = () => (connection ??= connect())[key];
  return new Proxy({} as Connection[K], {
    get(_, property) {
      const instance = target();
      const value = Reflect.get(instance, property, instance);
      return typeof value === "function" && property !== "constructor"
        ? value.bind(instance)
        : value;
    },
    has: (_, property) => Reflect.has(target(), property),
    getPrototypeOf: () => Object.getPrototypeOf(target()),
  });
}
export const pool = lazy("pool");
export const db = lazy("db");
