import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./docs/documento-mestre.md"] },
};
export default nextConfig;
