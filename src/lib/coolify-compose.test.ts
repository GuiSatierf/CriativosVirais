import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Checkouts on Windows turn line endings into CRLF.
const read = (file: string) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const compose = read("docker-compose.coolify.yml");
const documented = [...read(".env.production.example").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
  ([, name]) => name,
);

/** The environment lines of one service in the Coolify compose file. */
function serviceEnvironment(service: string) {
  const start = compose.indexOf(`\n  ${service}:\n`);
  if (start < 0) throw new Error(`service ${service} not found`);
  const next = compose.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  const block = next < 0 ? compose.slice(start) : compose.slice(start, start + 1 + next);
  return [...block.matchAll(/^ {6}- ([A-Z][A-Z0-9_]*)/gm)].map(([, name]) => name);
}

describe("Coolify compose", () => {
  // A variable set in Coolify but not listed here never reaches the container (Hotmart did not).
  it.each(["app", "worker"])("passes every documented production variable to the %s", (service) => {
    const environment = serviceEnvironment(service);
    const missing = documented.filter((name) => !environment.some((line) => line === name || line.startsWith(`${name}_`)));
    expect(missing).toEqual([]);
  });
});
