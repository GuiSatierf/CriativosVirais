import { describe, expect, it, vi } from "vitest";
import { createPool } from "./index";

const url = "postgresql://user:password@127.0.0.1:1/never_test";

describe("database pool", () => {
  it("survives an idle connection error, such as a database restart", async () => {
    const pool = createPool(url);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Without a listener, an "error" event throws and takes down the app or the worker.
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).not.toThrow();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    await pool.end();
  });

  it("bounds connection and statement time", async () => {
    const pool = createPool(url);
    expect(pool.options.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(pool.options.statement_timeout).toBeGreaterThan(0);
    await pool.end();
  });
});
