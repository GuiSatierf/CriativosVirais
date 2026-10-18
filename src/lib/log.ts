import { z } from "zod";
import { BackupError, ConfigError, DomainError, HttpError, RetryLaterError } from "./errors";

// Raw messages from drivers and providers can echo SQL values, prompts or client
// text, so only our own fixed messages are logged verbatim.
export function logError(context: string, error: unknown) {
  const e = error instanceof Error ? error : undefined;
  const code = (error as { code?: unknown; statusCode?: unknown } | undefined) ?? {};
  const own =
    error instanceof BackupError ||
    error instanceof ConfigError ||
    error instanceof DomainError ||
    error instanceof HttpError ||
    error instanceof RetryLaterError;
  const details = [
    e?.name ?? typeof error,
    typeof code.code === "string" ? `code=${code.code.slice(0, 40)}` : "",
    typeof code.statusCode === "number" ? `status=${code.statusCode}` : "",
    own ? e!.message : "",
    error instanceof z.ZodError ? `issues=${error.issues.length}` : "",
  ].filter(Boolean);
  const frames = (e?.stack ?? "")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .slice(0, 3)
    .map((line) => line.trim());
  console.error(`[${context}] ${details.join(" ")}`, ...frames);
}
