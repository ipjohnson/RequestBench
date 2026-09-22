// The delta against a test's base.
//
// The corpus pairs most performance tests with a base and names the one factor that differs.
// Walking `base` to a root gives a chain, and because every step is a difference of the same two
// published numbers the chain telescopes: the steps sum to the total over the root exactly. So
// one subtraction answers both "what did gzip cost" and "what does this test cost over the
// floor", and the two always agree.
//
// There is no single root. A chain ends wherever subtracting one more factor would start mixing
// two, so json.small roots the GET chains and body.bind_small roots the POST ones. Comparing a
// POST to json.small would fold request parsing into the delta.
//
// Both kinds of page take their deltas from here, the framework pages and the explorer's
// column, so the two cannot drift.
import type { Framework, Route } from "./types.ts";

/**
 * Every percentile is read off a histogram that grows 2% a bucket, so a published number is
 * one grid point and a difference of two carries both their errors. Twice the bucket at the
 * larger of the pair is the smallest difference that is the framework rather than the grid.
 * Below it the honest reading is that the factor adds no measurable time, which is a result:
 * sixteen no-op layers costing nothing is what that family is there to say.
 *
 * This is the resolution of the instrument, not a measured repeatability floor. Setting the
 * second takes repeat runs of one framework at one rung, which no run has done, and it will be
 * the larger of the two.
 */
export const BUCKET = 0.02;
export const FLOOR_BUCKETS = 2;

export const floorFor = (a: number, b: number): number =>
  BUCKET * FLOOR_BUCKETS * Math.max(Math.abs(a), Math.abs(b));

/** The kit's suite() refuses a cycle, so this bound is only reached if a page is serving
 *  routes that check never saw. Stopping quietly beats hanging the tab. */
export const MAX_CHAIN = 16;

export type Step = {
  arm: string;
  base: string;
  factor: string;
  armV: number;
  baseV: number;
  d: number;
  measurable: boolean;
};

export type Chain = {
  steps: Step[];
  /** What the total is against: the root of the base chain, or where comparedOf stopped. */
  root: string;
  armV: number;
  baseV: number;
  total: number;
  measurable: boolean;
};

/** One base edge: `arm` is `base` with `factor` varied. */
export type Link = { arm: string; base: string; factor: string };

type Routes = Readonly<Record<string, Route | undefined>>;

/** The ids from this test down to the root of its base chain. */
export function chainOf(id: string, routes: Routes): Link[] {
  const steps: Link[] = [];
  let cur = id;
  while (steps.length < MAX_CHAIN) {
    const r = routes[cur];
    if (!r || !r.b) break;
    steps.push({ arm: cur, base: r.b, factor: r.v ?? "" });
    cur = r.b;
  }
  return steps;
}

/** The factor the corpus varies to make json.large of json.small. */
export const SIZE = "size";

/**
 * The links a comparison on a test's own pane crosses: its own, then each one below it that
 * keeps the response body the same. Walking on to the root picks up what a larger body costs,
 * so compressed.gzip_large read against json.small is as much the large body as the gzip, and
 * against json.large it is only the compression. A test whose own link is the size, json.large,
 * still reads against the smaller one, because size is what it is there for.
 */
export function comparedOf(id: string, routes: Routes): Link[] {
  const links = chainOf(id, routes);
  const cut = links.findIndex((l, i) => i > 0 && l.factor === SIZE);
  return cut < 0 ? links : links.slice(0, cut);
}

/**
 * The value the delta is taken on is the selected metric and nothing else. achievedRps and
 * dropped are rung statistics no test carries, and substituting p50 there would put a p50
 * difference under a column headed dropped. No delta is the honest answer.
 */
export function testValue(f: Framework, id: string, rn: string, metric: string): number | null {
  const d = f.tests?.[id]?.rungs?.[rn];
  if (!d) return null;
  const v = (d as Record<string, unknown>)[metric];
  return typeof v === "number" ? v : null;
}

/**
 * The whole chain plus its total. `null` when the test is a root, or when the run is missing
 * either end: a test the corpus pairs but this run never measured has no delta rather than a
 * delta against nothing.
 */
export function deltaFor(f: Framework, id: string, rn: string, routes: Routes, metric = "p50Us"): Chain | null {
  return chainWith(chainOf(id, routes), (e) => testValue(f, e, rn, metric), floorFor);
}

/**
 * The chain across `links` on any number every test has one of. `floor` is the smallest
 * difference that number can resolve: the histogram's for a percentile, and zero for a byte
 * count, which is exact.
 */
export function chainWith(
  links: readonly Link[],
  valueOf: (id: string) => number | null,
  floor: (a: number, b: number) => number,
): Chain | null {
  const steps: Step[] = [];
  for (const s of links) {
    const arm = valueOf(s.arm);
    const base = valueOf(s.base);
    if (arm === null || base === null) return null;
    const d = arm - base;
    steps.push({ ...s, armV: arm, baseV: base, d, measurable: Math.abs(d) >= floor(arm, base) });
  }
  const last = steps[steps.length - 1];
  const first = steps[0];
  if (!last || !first) return null;
  const total = first.armV - last.baseV;
  return {
    steps,
    root: last.base,
    armV: first.armV,
    baseV: last.baseV,
    total,
    measurable: Math.abs(total) >= floor(first.armV, last.baseV),
  };
}
