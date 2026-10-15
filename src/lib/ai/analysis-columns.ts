import { videoAnalyses } from "@/db/schema";
/** Video analysis fields exposed to the model as untrusted evidence. */
export const analysisColumns = {
  transcript: videoAnalyses.transcript,
  segments: videoAnalyses.segments,
  narrative: videoAnalyses.narrative,
  awarenessEntry: videoAnalyses.awarenessEntry,
  awarenessExit: videoAnalyses.awarenessExit,
  skeleton: videoAnalyses.skeleton,
  format: videoAnalyses.format,
  proofTypes: videoAnalyses.proofTypes,
  cta: videoAnalyses.cta,
  visualNotes: videoAnalyses.visualNotes,
  uncertainties: videoAnalyses.uncertainties,
};
