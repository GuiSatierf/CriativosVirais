const slowAfterMs = 60_000;
const maxDelayMs = 30_000;

/** The base interval for the first minute, then doubling each minute up to 30 seconds. */
export function pollDelay(elapsedMs: number, baseMs: number) {
  if (elapsedMs < slowAfterMs) return baseMs;
  return Math.min(maxDelayMs, baseMs * 2 ** Math.floor(elapsedMs / slowAfterMs));
}

/** Resolves when the tab is visible, so a tab in the background stops asking the server. */
export function whenVisible() {
  return new Promise<void>((resolve) => {
    if (!document.hidden) return resolve();
    const onChange = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}
