// The tests pages: each family in the corpus's order, each base before the tests read against
// it, the notes above a family's tests, and the links into the corpus.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TestsView, TestView } from "../src/lib/bundleview.ts";
import { corpusLinks, familiesOf, familyPage, legendOf, readAgainst } from "../src/lib/corpus.ts";

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

describe("legendOf", () => {
  const call = (target: string, more: Record<string, unknown> = {}) => ({ method: "GET", target, headers: [], status: "200", checks: [], ...more });
  const calling = (...calls: ReturnType<typeof call>[]) => TestView.parse({ ...one("x"), calls });

  test("says nothing when no test needs it", () => {
    assert.deepEqual(legendOf([calling(call("/json/small"))]), []);
  });

  test("explains a value drawn per run, a drawn row and a declared refusal, once each", () => {
    const legend = legendOf([
      calling(call("/query?q={run.word}")),
      calling(call("/items/1", { body: { text: "{draw.item}", bytes: 11, truncated: false } })),
      calling(call("/body/validate", { status: "4XX", declared: "badRequest" }), call("/x?y={run.word}")),
    ]);
    assert.equal(legend.length, 3);
    assert.match(legend[0]!, /\{run\.name\}/);
    assert.match(legend[1]!, /\{draw\.item\}/);
    assert.match(legend[2]!, /4XX/);
  });
});

describe("corpusLinks", () => {
  const files = ["tests/payloads/small.json", "tests/payloads/items.csv"].map((path) => ({ path, role: "payload", bytes: 1, hash: "h" }));
  const payloads = TestsView.parse({
    bundle: { bundleVersion: "1", id: "tests", commit: "c0ffee", bundleHash: "h", codeHash: "h", files },
    tests: {},
  });

  test("links a committed payload by either name, and not one computed per request", () => {
    const { payloadHref } = corpusLinks({ view: payloads, repo: "ipjohnson/RequestBench", linkable: true });
    assert.equal(payloadHref("small"), "https://github.com/ipjohnson/RequestBench/blob/c0ffee/tests/payloads/small.json");
    assert.equal(payloadHref("items.csv"), "https://github.com/ipjohnson/RequestBench/blob/c0ffee/tests/payloads/items.csv");
    assert.equal(payloadHref("row"), null);
  });

  test("links nothing at a commit that cannot be linked", () => {
    const { link, payloadHref } = corpusLinks({ view: payloads, repo: "ipjohnson/RequestBench", linkable: false });
    assert.equal(link("tests/json/small.ts"), null);
    assert.equal(payloadHref("small"), null);
  });
});
