// Every rb.json check, each against a manifest that breaks only that check.
import assert from "node:assert/strict";
import { test } from "node:test";

import { loadFrameworks, type LoadInput } from "../manifest.ts";

const DIR = "frameworks/node/demo";
const MANIFEST = `${DIR}/rb.json`;

const GOOD = {
  framework: "Demo",
  licence: "MIT",
  repo: "https://github.com/example/demo",
  package: "https://www.npmjs.com/package/demo",
  lockfile: ["package-lock.json"],
  hosts: { "container-h1": { dockerfile: "Dockerfile" } },
  suite: { argv: ["node", "--test"], cwd: "suite", paths: ["suite"] },
  upgrade: { argv: ["npm", "update", "--save"] },
  skips: { "cors.scoped": "Demo's CORS feature applies to the whole application." },
  mechanisms: {
    json: { builtin: "The handler returns the object and the framework serialises it." },
    cors: { mechanism: "@demo/cors registered under /cors", dependency: "@demo/cors" },
  },
};

const FILES = [MANIFEST, `${DIR}/README.md`, `${DIR}/Dockerfile`, `${DIR}/package-lock.json`, `${DIR}/suite/app.test.js`];

function input(manifest: unknown, over: Partial<LoadInput> = {}): LoadInput {
  return {
    manifests: [MANIFEST],
    tracked: new Set(FILES),
    read: () => (typeof manifest === "string" ? manifest : JSON.stringify(manifest)),
    registry: ["node:demo"],
    tests: { "json.small": { kind: "performance" }, "cors.scoped": { kind: "validation" } },
    families: ["json", "cors"],
    ...over,
  };
}

const problemsOf = (manifest: unknown, over: Partial<LoadInput> = {}) => loadFrameworks(input(manifest, over)).problems;

test("a good manifest loads, and its declaration is what a validation test's scope reads", () => {
  const { frameworks, problems } = loadFrameworks(input(GOOD));
  assert.deepEqual(problems, []);
  assert.equal(frameworks.length, 1);
  const f = frameworks[0]!;
  assert.equal(f.id, "node:demo");
  assert.equal(f.dir, DIR);
  assert.deepEqual(f.declared, {
    language: "node",
    name: "demo",
    framework: "Demo",
    hosts: GOOD.hosts,
    mechanisms: GOOD.mechanisms,
  });
});

test("null says there is no lockfile or no upgrade, and says it on purpose", () => {
  assert.deepEqual(problemsOf({ ...GOOD, lockfile: null, upgrade: null }), []);
  const { upgrade: _, ...noUpgrade } = GOOD;
  assert.deepEqual(problemsOf(noUpgrade), [`${MANIFEST}: upgrade: Invalid input: expected object, received undefined`]);
});

test("the schema refuses what it does not name, and a manifest that is not JSON", () => {
  assert.deepEqual(problemsOf({ ...GOOD, build: ["make"] }), [`${MANIFEST}: the manifest: Unrecognized key: "build"`]);
  assert.match(problemsOf("{ nope")[0]!, /^frameworks\/node\/demo\/rb\.json: not JSON/);
  const host = { ...GOOD, hosts: { "container-h1": { dockerfile: "Dockerfile", run: ["x"] } } };
  assert.deepEqual(problemsOf(host), [`${MANIFEST}: hosts.container-h1: Unrecognized key: "run"`]);
  assert.deepEqual(problemsOf({ ...GOOD, hosts: {} }), [`${MANIFEST}: hosts: a framework implements at least one host`]);
});

test("every path it names is tracked and inside its directory", () => {
  assert.deepEqual(problemsOf({ ...GOOD, lockfile: ["yarn.lock"] }), [`${MANIFEST}: lockfile yarn.lock is not tracked`]);
  assert.deepEqual(problemsOf({ ...GOOD, lockfile: ["../package-lock.json"] }), [
    `${MANIFEST}: lockfile ../package-lock.json leaves the framework's directory`,
  ]);
  const dockerfile = { ...GOOD, hosts: { "container-h1": { dockerfile: "Dockerfile.h1" } } };
  assert.deepEqual(problemsOf(dockerfile), [`${MANIFEST}: hosts.container-h1.dockerfile Dockerfile.h1 is not tracked`]);
  const suite = { ...GOOD, suite: { ...GOOD.suite, paths: ["tests"] } };
  assert.deepEqual(problemsOf(suite), [`${MANIFEST}: suite.paths tests is not tracked`]);
  assert.deepEqual(problemsOf(GOOD, { tracked: new Set(FILES.filter((f) => !f.endsWith("README.md"))) }), [
    `${MANIFEST}: there is no README.md beside it`,
  ]);
});

test("a host must be one the benchmark measures on", () => {
  const hosts = { "container-h1": { dockerfile: "Dockerfile" }, "lambda-rie": { dockerfile: "Dockerfile" } };
  assert.deepEqual(problemsOf({ ...GOOD, hosts }), [`${MANIFEST}: hosts.lambda-rie is not a host, only container-h1 are`]);
});

test("a skip names a validation test, never a performance test and never nothing", () => {
  assert.deepEqual(problemsOf({ ...GOOD, skips: { "json.small": "too slow" } }), [
    `${MANIFEST}: skips.json.small is a performance test, which every framework answers (too slow)`,
  ]);
  assert.deepEqual(problemsOf({ ...GOOD, skips: { "cors.nope": "gone" } }), [`${MANIFEST}: skips.cors.nope names no test`]);
});

test("noHandler names a performance test, never a validation test and never nothing", () => {
  assert.deepEqual(problemsOf({ ...GOOD, noHandler: { "json.small": "The router answers it." } }), []);
  assert.deepEqual(problemsOf({ ...GOOD, noHandler: { "cors.scoped": "The router answers it." } }), [
    `${MANIFEST}: noHandler.cors.scoped is a validation test, which no framework has to locate a handler for`,
  ]);
  assert.deepEqual(problemsOf({ ...GOOD, noHandler: { "cors.nope": "gone" } }), [`${MANIFEST}: noHandler.cors.nope names no test`]);
});

test("every family has a mechanism entry, and no entry names a family that does not exist", () => {
  const missing = { ...GOOD, mechanisms: { json: GOOD.mechanisms.json } };
  assert.deepEqual(problemsOf(missing), [`${MANIFEST}: mechanisms has no entry for cors`]);
  const extra = { ...GOOD, mechanisms: { ...GOOD.mechanisms, domain: { builtin: "gone" } } };
  assert.deepEqual(problemsOf(extra), [`${MANIFEST}: mechanisms.domain names no family`]);
  const both = { ...GOOD, mechanisms: { ...GOOD.mechanisms, json: { builtin: "x", mechanism: "y" } } };
  assert.equal(problemsOf(both).length, 1);
});

test("a framework with an rb.json has an entry in frameworks/exceptions.ts", () => {
  assert.deepEqual(problemsOf(GOOD, { registry: ["node:other"] }), [
    "node:demo has an rb.json and no entry in frameworks/exceptions.ts",
  ]);
});
