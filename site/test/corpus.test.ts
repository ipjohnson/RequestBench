// The tests pages' order: each family in the corpus's order, and each base before the tests
// read against it.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TestsView } from "../src/lib/bundleview.ts";
import { familiesOf, familyPage, readAgainst } from "../src/lib/corpus.ts";

const one = (family: string, base?: string, kind = "performance") => ({
  kind,
  family,
  ...(base === undefined ? {} : { base, varies: "size" }),
  source: { path: "", hash: "", text: "" },
});

const corpus = (tests: Record<string, ReturnType<typeof one>>, families: string[]) =>
  TestsView.parse({
    bundle: { bundleVersion: "1", id: "tests", commit: "c", bundleHash: "h", codeHash: "h", files: [] },
    tests,
    families: Object.fromEntries(families.map((f) => [f, { about: `${f} about`, comparable: `${f} comparable` }])),
  });

const view = corpus(
  {
    "cache.small": one("cache", "json.small"),
    "cache.vary_many": one("cache", "cache.vary_one"),
    "cache.vary_one": one("cache", "cache.small"),
    "cors.scoped": one("cors", undefined, "validation"),
    "json.large": one("json", "json.small"),
    "json.medium": one("json", "json.small"),
    "json.small": one("json"),
  },
  ["cache", "cors", "json"],
);

describe("familiesOf", () => {
  test("puts each test after its base when the base is in the family, and counts what is measured", () => {
    assert.deepEqual(
      familiesOf(view).map((f) => [f.name, f.ids, f.measured]),
      [
        ["cache", ["cache.small", "cache.vary_one", "cache.vary_many"], 3],
        ["cors", ["cors.scoped"], 0],
        ["json", ["json.small", "json.large", "json.medium"], 3],
      ],
    );
  });

  test("still lists every test of a family whose bases loop, which the suite refuses", () => {
    const loop = corpus({ "x.a": one("x", "x.b"), "x.b": one("x", "x.a") }, ["x"]);
    assert.deepEqual(familiesOf(loop)[0]?.ids, ["x.a", "x.b"]);
  });

  test("carries the family's own words", () => {
    assert.deepEqual(
      familiesOf(view).map((f) => [f.about, f.comparable])[0],
      ["cache about", "cache comparable"],
    );
  });
});

test("readAgainst names the tests read against each base, across families", () => {
  const against = readAgainst(view);
  assert.deepEqual(against.get("json.small"), ["cache.small", "json.large", "json.medium"]);
  assert.deepEqual(against.get("cache.vary_one"), ["cache.vary_many"]);
  assert.equal(against.get("json.large"), undefined);
});

test("familyPage is relative to the page that links it", () => {
  assert.equal(familyPage("json", "root"), "tests/json.html");
  assert.equal(familyPage("json", "below"), "../tests/json.html");
});
