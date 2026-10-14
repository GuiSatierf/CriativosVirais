import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const braces = require("braces");
const installed = dirname(require.resolve("braces/package.json"));
const source = join(process.cwd(), "vendor/braces");
const metadata = require("braces/package.json");
assert.equal(metadata.name, "@criativosvirais/braces");
assert.equal(metadata.version, "3.0.3-patch.1");
for (const file of ["index.js", "LICENSE", "PATCH.md", "package.json", ...readdirSync(join(source, "lib")).map((name) => `lib/${name}`)]) {
  assert.equal(readFileSync(join(installed, file), "utf8"), readFileSync(join(source, file), "utf8"), `Installed fork differs from source: ${file}`);
}

const depthError = (error) => error instanceof SyntaxError && error.code === "ERR_BRACES_DEPTH";
const nested = (open, close, depth) => open.repeat(depth) + "a,b" + close.repeat(depth);
for (const pattern of [nested("{", "}", 4000), nested("(", ")", 4000), "{(".repeat(2000) + "a,b" + ")}".repeat(2000), "{".repeat(9000)]) {
  for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(pattern), depthError);
  }
}
assert.throws(() => braces.parse(nested("{", "}", 65), { maxDepth: Infinity, maxLength: Infinity }), depthError);
assert.doesNotThrow(() => braces.compile(nested("{", "}", 64)));
assert.doesNotThrow(() => braces.expand(nested("{", "}", 64)));
assert.doesNotThrow(() => braces.stringify(nested("(", ")", 64)));

const makeAst = (depth) => {
  let node = { type: "text", value: "a" };
  for (let i = 0; i < depth; i++) node = { type: "root", nodes: [node] };
  return node;
};
for (const operation of [braces.compile, braces.expand, braces.stringify]) {
  assert.throws(() => operation(makeAst(20000)), depthError);
  const cycle = { type: "root", nodes: [] };
  cycle.nodes.push(cycle);
  assert.throws(() => operation(cycle), depthError);
}

// Compatibility exercises nested alternatives, ranges, invalid blocks and literals.
for (const [pattern, expected] of [
  ["src/**/*.{ts,tsx}", ["src/**/*.ts", "src/**/*.tsx"]],
  ["{a,{b,c}}", ["a", "b", "c"]],
  ["x{01..03}y", ["x01y", "x02y", "x03y"]],
  ["{c..a}", ["c", "b", "a"]],
  ["{1..5..2}", ["1", "3", "5"]],
  ["{a,b}{1,2}", ["a1", "a2", "b1", "b2"]],
  ["a{b}c", ["a{b}c"]],
  ["{a,b", ["{a,b"]],
  ["\\{a,b\\}", ["{a,b}"]],
  ['"{a,b}"', ["{a,b}"]],
  ["[{}]", ["[{}]"]],
  ["${a,b}", ["${a,b}"]],
]) {
  assert.deepEqual(braces.expand(pattern), expected, pattern);
}
assert.equal(braces.compile("{a,b}"), "(a|b)");
assert.equal(braces.stringify(braces.parse("src/{a,{b,c}}.tsx")), "src/{a,{b,c}}.tsx");
assert.throws(() => braces.expand("{1..1001}"), /range limit/);
assert.throws(() => braces.parse("abc", { maxLength: 2 }), /max characters/);
assert.deepEqual(braces("{a,a}", { expand: true, nodupes: true }), ["a"]);

// Exercise both fast-glob versions and the ts-morph consumer shipped with shadcn.
const shadcnRequire = createRequire(require.resolve("shadcn"));
const nextRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
for (const consumer of [shadcnRequire, nextRequire]) {
  const glob = consumer("fast-glob");
  assert.ok(glob.sync("src/**/*.{ts,tsx}").length > 0);
  const match = createRequire(consumer.resolve("fast-glob"))("micromatch");
  const resolved = createRequire(consumer.resolve("fast-glob"));
  assert.equal(createRequire(resolved.resolve("micromatch"))("braces/package.json").name, metadata.name);
  assert.ok(match.isMatch("src/page.tsx", "src/**/*.{ts,tsx}"));
}
const { Project } = shadcnRequire("ts-morph");
const project = new Project({ skipAddingFilesFromTsConfig: true });
assert.ok(project.addSourceFilesAtPaths("src/**/*.{ts,tsx}").length > 0);

// Check a constrained Node stack too; malicious input must fail before recursion.
const child = spawnSync(process.execPath, ["--stack-size=256", "-e", `
const assert = require('node:assert/strict');
const braces = require('braces');
for (const method of [braces.compile, braces.expand, braces.stringify]) {
  assert.doesNotThrow(() => method('{'.repeat(64) + 'a,b' + '}'.repeat(64)));
  assert.throws(() => method('{'.repeat(4000) + 'a,b' + '}'.repeat(4000)), error => error.code === 'ERR_BRACES_DEPTH');
}
`], { cwd: process.cwd(), encoding: "utf8", timeout: 10000 });
assert.equal(child.status, 0, child.stderr || String(child.error));
console.log("Braces security regression, installed-source integrity and tool compatibility checks passed.");
