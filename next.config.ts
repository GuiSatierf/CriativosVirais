import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./docs/documento-mestre.md"] },
  // The Content-Security-Policy is set per request in src/proxy.ts, which needs a nonce.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Older browsers ignore frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
