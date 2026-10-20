// The generate-batch queue expires a job after one hour; past that, plus a margin, a generation
// still queued or running was abandoned (worker stopped mid-run) and will never finish.
const abandonedAfterMs = 65 * 60_000;

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
