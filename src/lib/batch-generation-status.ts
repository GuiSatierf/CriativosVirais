// The generate-batch queue expires a job after one hour; past that, plus a margin, a generation
// still queued or running was abandoned (worker stopped mid-run) and will never finish.
const abandonedAfterMs = 65 * 60_000;
/** Longest a generation (model calls plus quality review) may run in the worker. */
export const generationTimeoutMs = 30 * 60_000;
// A generation that waited in the queue past this point could still be running when the chat
// card gives up on it, so the worker refuses to start it instead of paying the model for nothing.
const latestStartMs = abandonedAfterMs - generationTimeoutMs - 5 * 60_000;

export type GenerationStatus = "queued" | "running" | "done" | "failed";

/** Status the chat card should show: an abandoned generation is reported as failed. */
export function visibleGenerationStatus(
  status: GenerationStatus,
  createdAt: Date,
  now: Date = new Date(),
): GenerationStatus {
  const pending = status === "queued" || status === "running";
  if (!pending) return status;
  if (now.getTime() - createdAt.getTime() > abandonedAfterMs) return "failed";
  return status;
}

/** Oldest creation time a queued generation may have for the worker to still start it. */
export function latestGenerationStart(now: Date = new Date()) {
  return new Date(now.getTime() - latestStartMs);
}
