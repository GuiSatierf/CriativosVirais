import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbEnv } from "../lib/env";
import * as schema from "./schema";

function connect() {
  const pool = new Pool({ connectionString: dbEnv().DATABASE_URL, max: 10 });
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
