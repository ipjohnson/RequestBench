// Blends: which tests a row at blend granularity is read over, and how it is read.
//
// A blend is a view of one run. The run offered every performance test in one mix, and a blend's
// p50, p90 and p99 are the geometric means of the p50s, p90s and p99s of the tests it takes from
// that run. A framework that could not sustain a rate under the mix has no latency at it in any
// blend, and the rate a blend is shown at is the mix's.
//
// A percentile of the tests' histograms merged would mostly say which test's band sits at that
// rank, so a blend is a mean. It is geometric because the tests differ too much in size for an
// arithmetic one, which would mostly follow the heaviest. Under a geometric mean a change of 10%
// in any one test moves the blend by the same amount.
//
// Each test counts once. No traffic share is right for every site, so a named blend says which
// features a kind of server uses and not how much of each. A custom blend can weight a family,
// which multiplies each of its tests.
import { familyOf, testOrder } from "./run.ts";
import type { Framework, Run } from "./types.ts";

export type BlendId = "all" | "web" | "api" | "custom";
export const BLENDS: readonly BlendId[] = ["all", "web", "api", "custom"];
export const isBlend = (s: string): s is BlendId => (BLENDS as readonly string[]).includes(s);

type Named = { readonly label: string; readonly tests: readonly string[] };

/** The blends the site names. All is every test the run measured, and custom is the reader's. */
export const NAMED = {
  // A server-rendered website: rendered pages, a static file, gzip, conditional requests, a form
  // post, the thirty headers a browser sends, and the two kinds of 404.
  web: {
    label: "Web",
    tests: [
      "compressed.gzip_large",
      "compressed.gzip_small",
      "errors.not_found",
      "errors.unmatched",
      "etag.large",
      "etag.match_large",
      "etag.small",
      "etag.stale_large",
      "forms.urlencoded",
      "headers.many",
      "middleware.four",
      "static.file",
      "template.medium",
      "template.small",
    ],
  },
  // A JSON API: rows and lists serialized, every method on one resource, path and query binding,
  // validated bodies and their refusal, bearer tokens, CORS, and every kind of error.
  api: {
    label: "API",
    tests: [
      "authorized.allowed",
      "authorized.denied",
      "body.rejected_all",
      "body.validate_medium",
      "body.validate_small",
      "cors.preflight",
      "cors.request",
      "errors.malformed",
      "errors.not_found",
      "errors.unmatched",
      "errors.wrong_method",
      "items.create",
      "items.delete",
      "items.head",
      "items.read",
      "items.replace",
      "items.update",
      "json.large",
      "json.medium",
      "json.small",
      "middleware.four",
      "parameters.one",
      "parameters.two",
      "query.many",
      "query.one",
    ],
  },
} as const satisfies Record<string, Named>;

export const labelOf = (b: BlendId): string => (b === "all" ? "All" : b === "custom" ? "Custom" : NAMED[b].label);

/** The blend a filter names, by its id or its label in any case. */
export function blendNamed(s: string): BlendId | null {
  const want = s.trim().toLowerCase();
  return isBlend(want) ? want : null;
}

/**
 * A custom blend as a link carries it. An entry is a family, which stands for every test the run
 * has in it, or a test id. A family missing from `weights` weighs 1.
 */
export type CustomBlend = { entries: string[]; weights: Record<string, number> };

/** A pick's entries as the run's test ids, in the run's order. */
export function testsOfPick(run: Run, entries: readonly string[]): string[] {
  const want = new Set(entries);
  return testOrder(run).filter((id) => want.has(id) || want.has(familyOf(run, id)));
}

/**
 * Test ids as a pick's entries: a family whose every test is taken becomes the family, so a
 * link stays short and still takes a test the family gains later.
 */
export function entriesOf(run: Run, ids: Iterable<string>): string[] {
  const taken = new Set(ids);
  const out: string[] = [];
  const byFamily = new Map<string, string[]>();
  for (const id of testOrder(run)) {
    const fam = familyOf(run, id);
    byFamily.set(fam, [...(byFamily.get(fam) ?? []), id]);
  }
  for (const [fam, every] of byFamily) {
    const mine = every.filter((id) => taken.has(id));
    if (mine.length === every.length) out.push(fam);
    else out.push(...mine);
  }
  return out;
}

/** The tests a blend takes from a run, each with its weight. A test the run did not measure is left out. */
export function weightsOf(run: Run, blend: BlendId, pick: CustomBlend): Map<string, number> {
  const order = testOrder(run);
  if (blend === "all") return new Map(order.map((id) => [id, 1]));
  if (blend !== "custom") {
    const named = new Set<string>(NAMED[blend].tests);
    return new Map(order.filter((id) => named.has(id)).map((id) => [id, 1]));
  }
  const out = new Map<string, number>();
  for (const id of testsOfPick(run, pick.entries)) {
    const w = pick.weights[familyOf(run, id)] ?? 1;
    if (w > 0) out.set(id, w);
  }
  return out;
}

/** Each family's share of a blend: its tests' weights over every test's. */
export function sharesOf(run: Run, weights: ReadonlyMap<string, number>): Map<string, number> {
  const byFamily = new Map<string, number>();
  let total = 0;
  for (const [id, w] of weights) {
    const fam = familyOf(run, id);
    byFamily.set(fam, (byFamily.get(fam) ?? 0) + w);
    total += w;
  }
  return new Map([...byFamily].map(([fam, w]) => [fam, total ? w / total : 0]));
}

/** A blend's percentiles, and `count`, the requests of its tests they are read from. */
export type BlendStats = { p50Us: number | null; p90Us: number | null; p99Us: number | null; count: number };

/**
 * One framework's latency over a blend at one rate: each percentile the geometric mean of its
 * tests' own, each test counted its weight times, as exp(Σ w ln x / Σ w). A test with no answers
 * at the rate has no percentiles and is left out. Null where none of the blend's tests has one,
 * which is so at a rate the framework did not complete.
 */
export function blendStats(f: Framework, rn: string, weights: ReadonlyMap<string, number>): BlendStats {
  const mean = (k: "p50Us" | "p90Us" | "p99Us"): number | null => {
    let logs = 0;
    let total = 0;
    for (const [id, w] of weights) {
      const x = f.tests[id]?.rungs?.[rn]?.[k];
      if (x == null || x <= 0) continue;
      logs += w * Math.log(x);
      total += w;
    }
    return total > 0 ? Math.exp(logs / total) : null;
  };
  let count = 0;
  for (const id of weights.keys()) count += f.tests[id]?.rungs?.[rn]?.count ?? 0;
  return { p50Us: mean("p50Us"), p90Us: mean("p90Us"), p99Us: mean("p99Us"), count };
}
