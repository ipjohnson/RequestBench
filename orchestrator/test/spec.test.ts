// The committed openapi.json is what the corpus generates now, so the document every
// framework is built against cannot fall behind the tests it answers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import suite from "@rb/tests";
import { corpus, DOCUMENT, openapi, render } from "../openapi.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const document = openapi(await corpus(ROOT));

test(`${DOCUMENT} is what the corpus generates`, () => {
  const committed = readFileSync(join(ROOT, DOCUMENT), "utf8").split("\n");
  const generated = render(document).split("\n");
  const at = Array.from({ length: Math.max(committed.length, generated.length) }, (_, i) => i).find((i) => committed[i] !== generated[i]);
  assert.equal(at, undefined, `${DOCUMENT} differs from line ${(at ?? 0) + 1}. Run npm run spec.`);
});

test(`${DOCUMENT} names every test`, () => {
  // A path item names the tests no route may answer, and each operation the tests it serves.
  const summary = (v: unknown) => (v !== null && typeof v === "object" && "summary" in v && typeof v.summary === "string" ? v.summary : "");
  const named = new Set<string>();
  for (const item of Object.values(document.paths as Record<string, Record<string, unknown>>)) {
    for (const part of [item, ...Object.values(item)]) for (const id of summary(part).split(", ")) named.add(id);
  }
  assert.deepEqual(Object.keys(suite.tests).filter((id) => !named.has(id)), []);
});
