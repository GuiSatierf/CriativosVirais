import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { emailEnv, emailOutboxEnv } from "./env";
import { ConfigError } from "./errors";

export type Email = { to: string; subject: string; text: string; html: string };

// RFC 2606 / 6761 names never receive mail; a real send there only bounces and hurts the sender's reputation.
const reservedDomain = /\.(test|example|invalid|localhost)$/i;

class ReservedAddressError extends Error {
  name = "ReservedAddressError";
}

/** Resend in production; a file outbox in development and tests, so no real message leaves the machine. */
export function canSendEmail() {
  return emailEnv() !== null || emailOutboxEnv() !== null;
}

export async function sendEmail(email: Email) {
  // The outbox wins over Resend: a developer's .env may hold a real key, and tests must never send.
  const outbox = emailOutboxEnv();
  if (outbox) return writeToOutbox(outbox.EMAIL_OUTBOX_DIR, email);
  const resend = emailEnv();
  if (resend == null) throw new ConfigError("email");

  if (reservedDomain.test(email.to.split("@").at(-1) ?? "")) throw new ReservedAddressError();

  return sendWithResend(resend, email);
}

async function sendWithResend(
  config: NonNullable<ReturnType<typeof emailEnv>>,
  email: Email,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw Object.assign(new Error("Resend request failed"), {
      statusCode: response.status,
    });
}

async function writeToOutbox(directory: string, email: Email) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${Date.now()}-${randomUUID()}.json`);
  await writeFile(file, JSON.stringify(email, null, 2));
}
