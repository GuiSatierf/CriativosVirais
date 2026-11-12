import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { startPostgresTool } from "./postgres";

const spawned = vi.hoisted(() => [] as { env: NodeJS.ProcessEnv }[]);
vi.mock("node:child_process", () => ({
  spawn: (_tool: string, _args: string[], options: { env: NodeJS.ProcessEnv }) => {
    spawned.push(options);
    return new EventEmitter();
  },
}));
vi.mock("@/lib/env", () => ({ dbEnv: () => ({ DATABASE_URL: "postgres://app:segredo@db.exemplo.test/app" }) }));

describe("postgres tools", () => {
  // Without a connect timeout, a database that never answered held the nightly backup forever.
  it("gives up on a database that does not accept the connection", () => {
    startPostgresTool("pg_dump", []);

    expect(spawned.at(-1)?.env.PGCONNECT_TIMEOUT).toBe("10");
  });
});
