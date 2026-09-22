// The corpus version moves when a question changes and stays put when only its prose does.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import type { Client, Suite, Test } from "@rb/tests/kit";
import { corpusVersion, endpoints, payloadFiles, recordAll } from "../corpus.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const payloads = payloadFiles(ROOT);

let base: string;

/** The suite with one test replaced. */
const with_ = (id: string, change: (t: Test) => Test): Suite => ({
  ...suite,
  tests: { ...suite.tests, [id]: change(suite.tests[id]!) },
});

const versionOf = async (s: Suite, files = payloads) => corpusVersion(s, await recordAll(s), files);

before(async () => {
  base = await versionOf(suite);
});

test("the version is stable across recordings", async () => {
  assert.equal(await versionOf(suite), base);
  assert.match(base, /^sha256:[0-9a-f]{64}$/);
});

test("prose does not move it", async () => {
  assert.equal(await versionOf(with_("json.small", (t) => ({ ...t, about: "reworded" }))), base);
});

test("a path, a header or an assertion moves it", async () => {
  assert.notEqual(await versionOf(with_("json.small", (t) => ({ ...t, path: "/json/tiny" }))), base);
  const extraHeader = (t: Test): Test => ({ ...t, request: (c: Client) => c.get("/json/small").header("x-extra", "1").ok() });
  assert.notEqual(await versionOf(with_("json.small", extraHeader)), base);
  const looser = (t: Test): Test => ({ ...t, request: (c: Client) => c.get("/json/small").ok() });
  assert.notEqual(await versionOf(with_("json.small", looser)), base);
});

test("a payload file moves it, and a validation test does not", async () => {
  const [first, ...rest] = payloads;
  assert.notEqual(await versionOf(suite, [{ ...first!, hash: "0".repeat(64) }, ...rest]), base);
  const validation = Object.values(suite.tests).find((t) => t.kind === "validation")!;
  const id = `${validation.id.family}.${validation.id.name}`;
  assert.equal(await versionOf(with_(id, (t) => ({ ...t, request: (c: Client) => c.get("/elsewhere").ok() }))), base);
});

test("every performance test is an endpoint, with the method its closure sends", async () => {
  const eps = endpoints(suite, await recordAll(suite));
  const byId = new Map(eps.map((e) => [e.id, e]));
  for (const t of Object.values(suite.tests)) {
    if (t.kind === "performance") assert.ok(byId.has(`${t.id.family}.${t.id.name}`), `${t.id.family}.${t.id.name} has no endpoint`);
  }
  assert.equal(byId.get("json.small")?.method, "GET");
  assert.equal(byId.get("items.create")?.method, "POST");
  assert.equal(byId.get("items.head")?.method, "HEAD");
  assert.equal(byId.get("cors.preflight")?.method, "OPTIONS");
});
