type PolicyOptions = {
  nonce: string;
  development: boolean;
  /** Origin the browser uploads to with presigned URLs; null when storage is not configured. */
  storageOrigin: string | null;
};

/**
 * Pages only run scripts that carry this request's nonce (Next.js adds it to its own), load
 * images and media from the app itself, and cannot be framed. Model and client text rendered in
 * the chat therefore cannot pull remote images or scripts, nor send data to another site.
 */
export function contentSecurityPolicy({ nonce, development, storageOrigin }: PolicyOptions) {
  const directives = [
    "default-src 'self'",
    // React rebuilds server error stacks with eval in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Server-rendered style attributes cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!development) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
