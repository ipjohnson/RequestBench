// Bundles over a scratch repository, so every role and both rollups are checked against files
// whose contents the test controls, and over this repository for the tests bundle.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import { frameworkBundle, frameworkProblems, rollup, testFiles, testsBundle, testsRole } from "../bundle.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEMO = { language: "node", name: "demo" };

let repo: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const rolesOf = (at?: string) => Object.fromEntries(frameworkBundle(repo, DEMO, at).files.map((f) => [f.path, f.role]));

before(() => {
  repo = mkdtempSync(join(tmpdir(), "rb-bundle-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  const dir = "frameworks/node/demo";
  put(`${dir}/rb.json`, JSON.stringify({ framework: "Demo", suite: { argv: ["node", "--test"], paths: ["suite"] } }));
  put(`${dir}/README.md`, "# Demo\n");
  put(`${dir}/Dockerfile`, "FROM node:26\n");
  put(`${dir}/package.json`, "{}\n");
  put(`${dir}/package-lock.json`, "{}\n");
  put(`${dir}/server.js`, "export const x = 1;\n");
  put(`${dir}/settings.yaml`, "a: 1\n");
  put(`${dir}/openapi.json`, "{}\n");
  put(`${dir}/suite/app.test.js`, "// a test\n");
  put(`${dir}/suite/package.json`, "{}\n");
  put(`${dir}/client-exception/index.ts`, "export default {};\n");
  put(`${dir}/handler_test.go`, "package main\n");
  put(`${dir}/Client/openapi.json`, "{}\n");
  put(`${dir}/Client/Kiota/client.ts`, "export const client = {};\n");
  put("frameworks/node/other/server.js", "// another framework\n");
  put("tests/index.ts", "export default [];\n");
  put("tests/package.json", "{}\n");
  put("tests/json/index.ts", "// family\n");
  put("tests/json/small.ts", "// a test\n");
  put("tests/json/rejected-all.snap.json", "{}\n");
  put("tests/kit/define.ts", "// kit\n");
  put("tests/models/item.ts", "// model\n");
  put("tests/payloads/items.small.json", "{}\n");
  put("tests/payloads/README.md", "# payloads\n");
  git("add", "-A");
  git("commit", "-qm", "init");
});

after(() => rmSync(repo, { recursive: true, force: true }));

test("a framework's files get the roles upstream's bundle.py gives them, and only its own files", () => {
  assert.deepEqual(rolesOf(), {
    "frameworks/node/demo/Client/Kiota/client.ts": "client",
    "frameworks/node/demo/Client/openapi.json": "client",
    "frameworks/node/demo/Dockerfile": "host",
    "frameworks/node/demo/README.md": "prose",
    "frameworks/node/demo/client-exception/index.ts": "test",
    "frameworks/node/demo/handler_test.go": "test",
    "frameworks/node/demo/openapi.json": "contract",
    "frameworks/node/demo/package-lock.json": "manifest",
    "frameworks/node/demo/package.json": "manifest",
    "frameworks/node/demo/rb.json": "manifest",
    "frameworks/node/demo/server.js": "source",
    "frameworks/node/demo/settings.yaml": "config",
    "frameworks/node/demo/suite/app.test.js": "test",
    "frameworks/node/demo/suite/package.json": "test",
  });
});

test("a rollup is sha256sum's own format over the sorted files", () => {
  const b = frameworkBundle(repo, DEMO);
  const text = b.files.map((f) => `${f.hash.slice(7)}  ${f.path}\n`).join("");
  assert.equal(b.bundleHash, `sha256:${createHash("sha256").update(text).digest("hex")}`);
  assert.equal(b.codeHash, rollup(b.files.filter((f) => f.role !== "prose" && f.role !== "test" && f.role !== "client")));
  assert.deepEqual(
    b.files.map((f) => f.path),
    [...b.files.map((f) => f.path)].sort(),
  );
});

test("prose and tests move bundleHash and leave codeHash alone", () => {
  const before = frameworkBundle(repo, DEMO);
  put("frameworks/node/demo/README.md", "# Demo, corrected\n");
  put("frameworks/node/demo/suite/app.test.js", "// a sharper test\n");
  const prose = frameworkBundle(repo, DEMO);
  assert.notEqual(prose.bundleHash, before.bundleHash);
  assert.equal(prose.codeHash, before.codeHash);

  put("frameworks/node/demo/server.js", "export const x = 2;\n");
  const code = frameworkBundle(repo, DEMO);
  assert.notEqual(code.codeHash, before.codeHash);

  // The commit still holds what was committed, which is what makes a dirty tree visible.
  const committed = frameworkBundle(repo, DEMO, "HEAD");
  assert.equal(committed.bundleHash, before.bundleHash);
  assert.equal(committed.commit, git("rev-parse", "HEAD"));
  git("checkout", "--", ".");
});

test("a regenerated client moves bundleHash and leaves codeHash alone", () => {
  const before = frameworkBundle(repo, DEMO);
  put("frameworks/node/demo/Client/openapi.json", '{ "openapi": "3.1.0" }\n');
  const after = frameworkBundle(repo, DEMO);
  assert.notEqual(after.bundleHash, before.bundleHash);
  assert.equal(after.codeHash, before.codeHash);
  git("checkout", "--", ".");
});

test("an untracked file never enters a bundle", () => {
  put("frameworks/node/demo/stray.js", "// not committed\n");
  assert.equal(rolesOf()["frameworks/node/demo/stray.js"], undefined);
  rmSync(join(repo, "frameworks/node/demo/stray.js"));
});

test("a bundle with no Dockerfile did not resolve", () => {
  assert.deepEqual(frameworkProblems(frameworkBundle(repo, DEMO)), []);
  git("rm", "-q", "frameworks/node/demo/Dockerfile");
  assert.deepEqual(frameworkProblems(frameworkBundle(repo, DEMO)), ["node:demo has no host file"]);
  git("reset", "-q", "HEAD", "--", "frameworks/node/demo/Dockerfile");
  git("checkout", "--", "frameworks/node/demo/Dockerfile");
});

test("the tests bundle gives each part of the corpus its role, and codeHash ignores prose and snapshots", () => {
  const b = testsBundle(repo);
  assert.deepEqual(Object.fromEntries(b.files.map((f) => [f.path, f.role])), {
    "tests/index.ts": "family",
    "tests/json/index.ts": "family",
    "tests/json/rejected-all.snap.json": "snapshot",
    "tests/json/small.ts": "test",
    "tests/kit/define.ts": "kit",
    "tests/models/item.ts": "model",
    "tests/package.json": "manifest",
    "tests/payloads/README.md": "prose",
    "tests/payloads/items.small.json": "payload",
  });
  const code = b.codeHash;
  put("tests/json/rejected-all.snap.json", '{"changed":true}\n');
  assert.equal(testsBundle(repo).codeHash, code);
  put("tests/json/small.ts", "// a changed test\n");
  assert.notEqual(testsBundle(repo).codeHash, code);
  git("checkout", "--", ".");
});

test("every test in the corpus is found in the file its id names, and every test file holds one", () => {
  const files = testFiles(testsBundle(ROOT));
  const ids = Object.keys(suite.tests).sort();
  assert.deepEqual([...files.keys()].sort(), ids);
  assert.equal(testsRole("tests/json/small.ts"), "test");
});
