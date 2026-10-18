import { describe, expect, it } from "vitest";
import { evaluateHealth } from "./health";

const healthy = { database: true, workerLastSeenSeconds: 20, oldestWaitingJobSeconds: null };

describe("system health", () => {
  it("is ok when the database answers, the worker is alive and no job waits too long", () => {
    expect(evaluateHealth(healthy)).toEqual({ ok: true, problems: [] });
  });

  it("reports the database, a silent worker and a stalled queue", () => {
    expect(evaluateHealth({ ...healthy, database: false }).problems).toEqual(["database"]);
    // Never started (no pg-boss schema) or silent for longer than the limit.
    expect(evaluateHealth({ ...healthy, workerLastSeenSeconds: null }).problems).toEqual(["worker"]);
    expect(evaluateHealth({ ...healthy, workerLastSeenSeconds: 600 }).problems).toEqual(["worker"]);
    expect(evaluateHealth({ ...healthy, oldestWaitingJobSeconds: 1_200 }).problems).toEqual(["queue"]);
  });
});
