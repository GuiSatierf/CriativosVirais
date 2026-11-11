import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { handle, readBody } from "@/lib/http";
export const runtime = "nodejs";

// Auth bodies are a few fields; Better Auth reads the whole body before any check, and the
// proxy's body limit does not cover /api, so an oversized request is refused before it is read.
const maxBodyBytes = 64_000;

async function boundedRequest(request: Request) {
  if (request.body == null) return request;
  const body = await readBody(request, maxBodyBytes);
  // Rebuilt from its parts: copying Next's request object into a new Request throws.
  return new Request(request.url, { method: request.method, headers: request.headers, body, signal: request.signal });
}

export const GET = (request: Request) =>
  toNextJsHandler(getAuth()).GET(request);
export const POST = (request: Request) =>
  handle(async () => toNextJsHandler(getAuth()).POST(await boundedRequest(request)));
