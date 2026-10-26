/**
 * Voice notes wait in the composer while the user watches, so they never queue behind videos,
 * which take minutes each. Both run the same analysis job.
 */
export function analysisQueue(kind: "video" | "audio") {
  return kind === "audio" ? "transcribe-audio" : "analyze-video";
}
