// The base chain, which is the one piece of arithmetic on the page.
//
// Both kinds of page take their deltas from delta.ts. These are the properties that make the
// number trustworthy.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chainOf, chainWith, comparedOf, deltaFor, floorFor, MAX_CHAIN, SIZE } from "../src/lib/delta.ts";
import type { Framework, Route } from "../src/lib/types.ts";

/** json.small roots the GET chain; each arm varies one factor from the one under it. */
const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.medium": { m: "GET", p: "/json/medium", b: "json.small", v: "size" },
  "compressed.gzip_small": { m: "GET", p: "/compressed/small", b: "json.medium", v: "compression" },
};

const framework = (values: Record<string, number>): Framework => ({
  id: "go:chi",
  language: "go",
  name: "chi",
  rungs: {},
  families: {},
  tests: Object.fromEntries(Object.entries(values).map(([id, v]) => [id, { rungs: { regular: { p50Us: v, count: 10 } } }])),
});

describe("chainOf", () => {
  test("walks every base edge down to the root", () => {
    assert.deepEqual(
      chainOf("compressed.gzip_small", routes).map((s) => s.base),
      ["json.medium", "json.small"],
    );
  });

  test("a root has no chain", () => {
    assert.deepEqual(chainOf("json.small", routes), []);
  });

  test("stops rather than hanging on a cycle the kit never saw", () => {
    const cyclic: Record<string, Route> = {
      a: { m: "GET", p: "/a", b: "b", v: "x" },
      b: { m: "GET", p: "/b", b: "a", v: "x" },
    };
    assert.equal(chainOf("a", cyclic).length, MAX_CHAIN);
  });
});

describe("deltaFor", () => {
  test("the steps sum to the total over the root exactly", () => {
    const f = framework({ "json.small": 100, "json.medium": 160, "compressed.gzip_small": 900 });
    const chain = deltaFor(f, "compressed.gzip_small", "regular", routes);
    assert.ok(chain);
    assert.equal(chain.root, "json.small");
    assert.equal(chain.total, 800);
    assert.equal(
      chain.steps.reduce((s, x) => s + x.d, 0),
      chain.total,
    );
  });

  test("a root carries no delta", () => {
    assert.equal(deltaFor(framework({ "json.small": 100 }), "json.small", "regular", routes), null);
  });

  test("a test the run never measured has no delta rather than one against nothing", () => {
    const f = framework({ "json.small": 100, "compressed.gzip_small": 900 });
    assert.equal(deltaFor(f, "compressed.gzip_small", "regular", routes), null);
  });

  test("a difference inside the histogram's grid reads as no measurable time", () => {
    const f = framework({ "json.small": 100, "json.medium": 101 });
    const chain = deltaFor(f, "json.medium", "regular", routes);
    assert.equal(chain?.total, 1);
    assert.equal(chain?.measurable, false);
    assert.ok(Math.abs(floorFor(101, 100) - 4.04) < 1e-9);
  });

  test("achievedRps is a rung statistic, so a test has no delta on it", () => {
    const f = framework({ "json.small": 100, "json.medium": 160 });
    assert.equal(deltaFor(f, "json.medium", "regular", routes, "achievedRps"), null);
  });
});

describe("chainWith", () => {
  const bytes: Record<string, number> = { "json.small": 125, "json.medium": 126, "compressed.gzip_small": 40 };
  const sizeOf = (id: string): number | null => bytes[id] ?? null;

  test("a byte count is exact, so a one-byte difference is measurable", () => {
    const chain = chainWith(chainOf("json.medium", routes), sizeOf, () => 0);
    assert.equal(chain?.total, 1);
    assert.equal(chain?.measurable, true);
  });

  test("the steps sum to the total over any number, not only a percentile", () => {
    const chain = chainWith(chainOf("compressed.gzip_small", routes), sizeOf, () => 0);
    assert.equal(chain?.total, -85);
    assert.equal(
      chain?.steps.reduce((s, x) => s + x.d, 0),
      chain?.total,
    );
  });
});

describe("comparedOf", () => {
  // The corpus's own edges for the large body.
  const corpus: Record<string, Route> = {
    "json.small": { m: "GET", p: "/json/small" },
    "json.large": { m: "GET", p: "/json/large", b: "json.small", v: SIZE },
    "compressed.identity_large": { m: "GET", p: "/compressed/large", b: "json.large", v: "compression_wiring" },
    "compressed.gzip_large": { m: "GET", p: "/compressed/large", b: "compressed.identity_large", v: "compression" },
  };

  test("stops at the base with the same body, so the difference is only the compression", () => {
    const links = comparedOf("compressed.gzip_large", corpus);
    assert.deepEqual(
      links.map((l) => l.factor),
      ["compression", "compression_wiring"],
    );
    assert.equal(links[links.length - 1]?.base, "json.large");
  });

  test("a test that is there for its size still reads against the smaller one", () => {
    assert.deepEqual(
      comparedOf("json.large", corpus).map((l) => l.base),
      ["json.small"],
    );
  });

  test("a root has nothing to compare", () => {
    assert.deepEqual(comparedOf("json.small", corpus), []);
  });
});
