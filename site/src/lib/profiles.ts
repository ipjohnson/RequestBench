// Profiles: which tests a row at profile granularity is read over, and how it is read.
//
// A profile is a view of one run. The run offered every performance test in one mix, and a
// profile's p50, p90 and p99 are the geometric means of the p50s, p90s and p99s of the tests it
// takes from that run. A framework that could not sustain a rate under the mix has no latency at
// it in any profile, and the rate a profile is shown at is the mix's.
//
// A percentile of the tests' histograms merged would mostly say which test's band sits at that
// rank, so a profile is a mean. It is geometric because the tests differ too much in size for an
// arithmetic one, which would mostly follow the heaviest. Under a geometric mean a change of 10%
// in any one test moves the profile by the same amount.
//
// Each test counts once. No traffic share is right for every site, so a named profile says which
// features a kind of server uses and not how much of each. A light profile takes the tests of its
// kind whose heft the run recorded as LIGHT or under, so a test whose heft moves joins or leaves
// it. A custom profile can weight a family, which multiplies each of its tests.
import { familyOf, heftOf, testOrder } from "./run.ts";
import type { Framework, Run } from "./types.ts";

export type ProfileId = "all" | "web-all" | "web-light" | "api-all" | "api-light" | "api-validation" | "custom";
export const PROFILES: readonly ProfileId[] = ["all", "web-all", "web-light", "api-all", "api-light", "api-validation", "custom"];
export const isProfile = (s: string): s is ProfileId => (PROFILES as readonly string[]).includes(s);

/** The heaviest heft a light profile takes. */
export const LIGHT = 2;

/** Each light profile, and the profile whose tests it takes at heft LIGHT and under. */
export const LIGHT_OF = { "web-light": "web-all", "api-light": "api-all" } as const;
export const isLight = (p: ProfileId): p is keyof typeof LIGHT_OF => p in LIGHT_OF;

/**
 * The profiles whose tests are named. The profile all is every test the run measured, and custom
 * is the reader's.
 */
export const NAMED = {
  // A server-rendered website: rendered pages, a static file, gzip, conditional requests, a form
  // post, the thirty headers a browser sends, and the two kinds of 404.
  "web-all": {
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
  "api-all": {
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
  // A JSON API's checks on what it is sent: bodies validated and refused, and a body that is not
  // JSON at all.
  "api-validation": {
    tests: ["body.rejected_all", "body.rejected_first", "body.validate_medium", "body.validate_small", "errors.malformed"],
  },
} as const satisfies Record<string, { readonly tests: readonly string[] }>;

/** What a link from before profiles named, and the profile it names now. */
const WAS: Readonly<Record<string, ProfileId>> = { web: "web-all", api: "api-all" };

/** The profile a filter names, by its id in any case. */
export function profileNamed(s: string): ProfileId | null {
  const want = s.trim().toLowerCase();
  return isProfile(want) ? want : (WAS[want] ?? null);
}

/**
 * A custom profile as a link carries it. An entry is a family, which stands for every test the run
 * has in it, or a test id. A family missing from `weights` weighs 1.
 */
export type CustomProfile = { entries: string[]; weights: Record<string, number> };

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

/**
 * The tests a profile takes from a run, each with its weight. A test the run did not measure is
 * left out, and so is a test with no recorded heft from a light profile.
 */
export function weightsOf(run: Run, profile: ProfileId, pick: CustomProfile): Map<string, number> {
  const order = testOrder(run);
  if (profile === "all") return new Map(order.map((id) => [id, 1]));
  if (isLight(profile)) {
    const named = new Set<string>(NAMED[LIGHT_OF[profile]].tests);
    return new Map(order.filter((id) => named.has(id) && (heftOf(run, id) ?? Infinity) <= LIGHT).map((id) => [id, 1]));
  }
  if (profile !== "custom") {
    const named = new Set<string>(NAMED[profile].tests);
    return new Map(order.filter((id) => named.has(id)).map((id) => [id, 1]));
  }
  const out = new Map<string, number>();
  for (const id of testsOfPick(run, pick.entries)) {
    const w = pick.weights[familyOf(run, id)] ?? 1;
    if (w > 0) out.set(id, w);
  }
  return out;
}

/** Each family's share of a profile: its tests' weights over every test's. */
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

/** A profile's percentiles, and `count`, the requests of its tests they are read from. */
export type ProfileStats = { p50Us: number | null; p90Us: number | null; p99Us: number | null; count: number };

/**
 * One framework's latency over a profile at one rate: each percentile the geometric mean of its
 * tests' own, each test counted its weight times, as exp(Σ w ln x / Σ w). A test with no answers
 * at the rate has no percentiles and is left out. Null where none of the profile's tests has one,
 * which is so at a rate the framework did not complete.
 */
export function profileStats(f: Framework, rn: string, weights: ReadonlyMap<string, number>): ProfileStats {
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
