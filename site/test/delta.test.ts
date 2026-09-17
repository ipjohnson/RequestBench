// The base chain, which is the one piece of arithmetic on the page.
//
// The framework pages and the explorer's column used to compute it separately and could drift.
// These are the properties that make the number trustworthy, over the one implementation left.
import { describe, expect, test } from "vitest";
import { chainOf, deltaFor, floorFor, MAX_CHAIN } from "../src/lib/delta.js";
import type { Route, Target } from "../src/lib/types.js";

/** json.small roots the GET chain; each arm varies one factor from the one under it. */
const routes: Record<string, Route> = {
  "json.small": { m: "GET", p: "/json/small" },
  "json.medium": { m: "GET", p: "/json/medium", b: "json.small", v: "payload.size" },
  "compressed.medium": { m: "GET", p: "/compressed/medium", b: "json.medium", v: "encoding.gzip" },
};

const target = (values: Record<string, number>): Target => ({
  language: "go",
  target: "chi",
  rungs: {},
  endpoints: Object.fromEntries(
    Object.entries(values).map(([eid, v]) => [eid, { rungs: { "1": { p50_us: v, count: 10 } } }]),
  ),
});

describe("chainOf", () => {
  test("walks every base edge down to the root", () => {
    expect(chainOf("compressed.medium", routes).map((s) => s.base)).toEqual([
      "json.medium",
      "json.small",
    ]);
  });

  test("a root has no chain", () => {
    expect(chainOf("json.small", routes)).toEqual([]);
  });

  test("stops rather than hanging on a cycle the spec check never saw", () => {
    const cyclic: Record<string, Route> = {
      a: { m: "GET", p: "/a", b: "b", v: "x" },
      b: { m: "GET", p: "/b", b: "a", v: "x" },
    };
    expect(chainOf("a", cyclic)).toHaveLength(MAX_CHAIN);
  });
});

describe("deltaFor", () => {
  test("the steps sum to the total over the root exactly", () => {
    const t = target({ "json.small": 100, "json.medium": 160, "compressed.medium": 900 });
    const chain = deltaFor(t, "compressed.medium", "1", routes);
    expect(chain).not.toBeNull();
    expect(chain?.root).toBe("json.small");
    expect(chain?.total).toBe(800);
    expect(chain?.steps.reduce((s, x) => s + x.d, 0)).toBe(chain?.total);
  });

  test("a root carries no delta", () => {
    expect(deltaFor(target({ "json.small": 100 }), "json.small", "1", routes)).toBeNull();
  });

  test("an endpoint the run never measured has no delta rather than one against nothing", () => {
    const t = target({ "json.small": 100, "compressed.medium": 900 });
    expect(deltaFor(t, "compressed.medium", "1", routes)).toBeNull();
  });

  test("a difference inside the histogram's grid reads as no measurable time", () => {
    const t = target({ "json.small": 100, "json.medium": 101 });
    const chain = deltaFor(t, "json.medium", "1", routes);
    expect(chain?.total).toBe(1);
    expect(chain?.measurable).toBe(false);
    expect(floorFor(101, 100)).toBeCloseTo(4.04);
  });

  test("achieved_rps is a rung statistic, so an endpoint has no delta on it", () => {
    const t = target({ "json.small": 100, "json.medium": 160 });
    expect(deltaFor(t, "json.medium", "1", routes, "achieved_rps")).toBeNull();
  });
});
