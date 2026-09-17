// The delta against an endpoint's base.
//
// spec/endpoints.json pairs most endpoints with a base and names the one factor that
// differs. Walking `base` to a root gives a chain, and because every step is a difference of
// the same two published numbers the chain telescopes: the steps sum to the total over the
// root exactly. So one subtraction answers both "what did gzip cost" and "what does this
// endpoint cost over the floor", and the two always agree.
//
// There is no single root. A chain ends wherever subtracting one more factor would start
// mixing two, so json.small roots the GET chains and body.bind_small roots the POST ones.
// Comparing a POST to json.small would fold request parsing into the delta.
//
// This used to exist twice, once for the framework pages and once for the explorer's column,
// with a comment on each saying the two had to be changed together. One workspace is what
// makes it one function.
import type { Route, Target } from "./types.js";

/**
 * Every percentile is read off a histogram that grows 2% a bucket, so a published number is
 * one grid point and a difference of two carries both their errors. Twice the bucket at the
 * larger of the pair is the smallest difference that is the framework rather than the grid.
 * Below it the honest reading is that the factor adds no measurable time, which is a result:
 * sixteen no-op layers costing nothing is what that family is there to say.
 *
 * This is the resolution of the instrument, not a measured repeatability floor. Setting the
 * second takes repeat runs of one target at one rung, which no run has done, and it will be
 * the larger of the two.
 */
export const BUCKET = 0.02;
export const FLOOR_BUCKETS = 2;

export const floorFor = (a: number, b: number): number =>
  BUCKET * FLOOR_BUCKETS * Math.max(Math.abs(a), Math.abs(b));

/** harness/plan.py rejects a cycle, so this bound is only reached if a page is serving a
 *  spec that check never saw. Stopping quietly beats hanging the tab. */
export const MAX_CHAIN = 16;

export type Step = {
  arm: string;
  base: string;
  factor: string;
  arm_v: number;
  base_v: number;
  d: number;
  measurable: boolean;
};

export type Chain = {
  steps: Step[];
  root: string;
  arm_v: number;
  base_v: number;
  total: number;
  measurable: boolean;
};

type Routes = Readonly<Record<string, Route | undefined>>;

/** The ids from this endpoint down to the root of its base chain. */
export function chainOf(eid: string, routes: Routes): { arm: string; base: string; factor: string }[] {
  const steps: { arm: string; base: string; factor: string }[] = [];
  let cur = eid;
  while (steps.length < MAX_CHAIN) {
    const r = routes[cur];
    if (!r || !r.b) break;
    steps.push({ arm: cur, base: r.b, factor: r.v ?? "" });
    cur = r.b;
  }
  return steps;
}

/**
 * The value the delta is taken on is the selected metric and nothing else. achieved_rps and
 * dropped are rung statistics no endpoint carries, and substituting p50 there would put a
 * p50 difference under a column headed dropped. No delta is the honest answer.
 */
export function epValue(t: Target, eid: string, rn: string, metric: string): number | null {
  const d = t.endpoints?.[eid]?.rungs?.[rn];
  if (!d) return null;
  const v = (d as Record<string, unknown>)[metric];
  return typeof v === "number" ? v : null;
}

/**
 * The whole chain plus its total. `null` when the endpoint is a root, or when the run is
 * missing either end: an endpoint the spec pairs but this run never measured has no delta
 * rather than a delta against nothing.
 */
export function deltaFor(
  t: Target,
  eid: string,
  rn: string,
  routes: Routes,
  metric = "p50_us",
): Chain | null {
  const steps: Step[] = [];
  for (const s of chainOf(eid, routes)) {
    const arm = epValue(t, s.arm, rn, metric);
    const base = epValue(t, s.base, rn, metric);
    if (arm === null || base === null) return null;
    const d = arm - base;
    steps.push({ ...s, arm_v: arm, base_v: base, d, measurable: Math.abs(d) >= floorFor(arm, base) });
  }
  const last = steps[steps.length - 1];
  const first = steps[0];
  if (!last || !first) return null;
  const total = first.arm_v - last.base_v;
  return {
    steps,
    root: last.base,
    arm_v: first.arm_v,
    base_v: last.base_v,
    total,
    measurable: Math.abs(total) >= floorFor(first.arm_v, last.base_v),
  };
}
