/**
 * How the visitor's IP is found behind Cloudflare and the Coolify proxy (Traefik), for the sign-in
 * rate limit and the access log. Every proxy appends the address it got the request from to
 * X-Forwarded-For, so the list is read from the right, skipping known proxies: the first address no
 * proxy vouches for is the visitor, and a header the visitor sends only adds entries to its left.
 * When the list holds only proxies (Traefik kept just the Cloudflare edge), the request did come
 * through Cloudflare, which sets CF-Connecting-IP itself.
 */

// Cloudflare's published edge ranges, from https://www.cloudflare.com/ips-v4 and /ips-v6 (read on 2026-11-10).
const cloudflareRanges = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

// Docker networks and the host, where Traefik hands requests to the app; no visitor comes from them.
const internalRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7"];

export const clientIpOptions = {
  ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip"],
  trustedProxies: [...cloudflareRanges, ...internalRanges],
};
