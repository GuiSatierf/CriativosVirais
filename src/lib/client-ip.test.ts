import { getIP } from "better-auth/api";
import { describe, expect, test } from "vitest";
import { clientIpOptions } from "./client-ip";

const visitorIp = (headers: Record<string, string>) => getIP(new Headers(headers), { advanced: { ipAddress: clientIpOptions } });

// 172.70.1.1 is a Cloudflare edge address; 10.0.2.4 a Docker network address.
describe("visitor IP behind Cloudflare and Traefik", () => {
  test("reads the visitor before the Cloudflare edge in a two-value forwarded header", () => {
    expect(visitorIp({ "x-forwarded-for": "203.0.113.5, 172.70.1.1" })).toBe("203.0.113.5");
  });

  test("ignores addresses a visitor adds to the left of the forwarded header", () => {
    expect(visitorIp({ "x-forwarded-for": "198.51.100.9, 203.0.113.5, 172.70.1.1" })).toBe("203.0.113.5");
  });

  test("skips the internal hop between Traefik and the app", () => {
    expect(visitorIp({ "x-forwarded-for": "203.0.113.5, 10.0.2.4" })).toBe("203.0.113.5");
  });

  test("uses Cloudflare's header when the forwarded header holds only the Cloudflare edge", () => {
    expect(visitorIp({ "x-forwarded-for": "172.70.1.1", "cf-connecting-ip": "203.0.113.5" })).toBe("203.0.113.5");
  });

  test("ignores a Cloudflare header sent by a visitor that did not come through Cloudflare", () => {
    expect(visitorIp({ "x-forwarded-for": "198.51.100.7", "cf-connecting-ip": "203.0.113.5" })).toBe("198.51.100.7");
  });
});
