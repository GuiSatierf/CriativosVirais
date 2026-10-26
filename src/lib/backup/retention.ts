import { BackupError } from "@/lib/errors";

const dailyCopies = 7;
const weeklyCopies = 4;
/** Files removed from the app stay this long in the backup, so a mistaken deletion can be undone. */
export const deletedFilesKeptDays = 30;

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const dayInMs = 86_400_000;

function isSunday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
}

/** Keeps the last 7 daily dumps plus the last 4 Sunday dumps; returns the days to delete. */
export function dumpDaysToDelete(days: readonly string[]) {
  const newestFirst = [...new Set(days.filter((day) => dayPattern.test(day)))].sort().reverse();
  const keep = new Set(newestFirst.slice(0, dailyCopies));
  for (const day of newestFirst.filter(isSunday).slice(0, weeklyCopies)) keep.add(day);
  return newestFirst.filter((day) => !keep.has(day));
}

/** Days of removed files that are past the grace period on `today` (YYYY-MM-DD). */
export function deletedFileDaysToPurge(days: readonly string[], today: string) {
  const limit = Date.parse(`${today}T00:00:00Z`) - deletedFilesKeptDays * dayInMs;
  return [...new Set(days)].filter(
    (day) => dayPattern.test(day) && Date.parse(`${day}T00:00:00Z`) < limit,
  );
}

/**
 * Backed-up copies (`prefix` + original key) whose original is gone. An empty source with copies
 * present means storage points at the wrong bucket, not that every file was deleted: refuse.
 */
export function copiesOfRemovedFiles(
  originals: ReadonlySet<string>,
  copies: readonly string[],
  prefix: string,
) {
  if (originals.size === 0 && copies.length > 0)
    throw new BackupError("Storage lists no files while the backup has copies; refusing to set them aside");
  return copies.filter((copy) => !originals.has(copy.slice(prefix.length)));
}
