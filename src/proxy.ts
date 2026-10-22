import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/content-security-policy";
import { storageEnv } from "@/lib/env";

/** Browser uploads go straight to the public storage endpoint through presigned URLs. */
function storageOrigin() {
  try {
    const env = storageEnv();
    return new URL(env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT).origin;
  } catch {
    // Without storage configuration uploads are refused by the API anyway; the page still loads.
    return null;
  }
}

/** Sets a per-request nonce Content-Security-Policy; Next.js reads it to tag its own scripts. */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === "development",
    storageOrigin: storageOrigin(),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // API responses are not documents; static files carry no inline code.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
