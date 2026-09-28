// A run file collapsed into what the site reads and keeps: per test its heft, per test and per
// rung the percentiles, a coarse histogram, the generator's own histogram and the count and
// percentiles of each window of the recording, per family the geometric mean of its tests'
// percentiles, and per rung what was offered, achieved and dropped. A port of upstream's
// harness/summarize.py.
//
// Nothing is divided by anything, except where a family's mean fills in a test the framework has
// no answers for, at its ratio to the other frameworks. A rung a framework did not complete
// publishes what it achieved and dropped and no latency: the generator drops by never sending,
// so percentiles over what survived would flatter the frameworks that collapse hardest.
//
// lambda-emulator's closed loop has one rung and nothing to drop. Its latency is the invoke
// phase, and each test carries the other spans beside it.
import type { Heft } from "@rb/tests/kit";
import { CACHE_LIFETIME_SECONDS } from "@rb/tests/models/cache";
import { BUCKETS, GROWTH, LOG_GROWTH, addInto, pct } from "../traffic-generator/histogram.ts";
import {
  WINDOW_SECONDS,
  isClosed,
  type CacheSummary,
  type ClosedRecordedSummary,
  type ClosedResult,
  type LoadResult,
  type PhaseResult,
  type Window,
} from "../traffic-generator/load.ts";
import type { FrameworkRun, RunFile } from "./measure.ts";

/**
 * The coarse grid a page draws a distribution on: eight bins a decade from 10 µs reaches 750 ms
 * in 39 columns, wide enough to tell two apart on screen. It starts at 10 µs because a Lambda
 * invocation on the emulator can take less than 80 µs. Changing it changes what a summary means,
 * so it is written into every summary rather than agreed out of band.
 */
export const BIN_GRID = { loUs: 10, perDecade: 8, count: 39 } as const;

/**
 * The generator's grid, which each test's `hist` is counted on: bucket i starts at growth^i µs.
 * It is written into every summary like BIN_GRID, so a histogram can be read without the
 * generator's source.
 */
export const HIST_GRID = { growth: GROWTH, count: BUCKETS } as const;

/**
 * How long each test's windows last, and what each place in a window holds. A run has tens of
 * thousands of windows, so each is a tuple and its places are named once, in every summary.
 */
export const WINDOW_GRID = { seconds: WINDOW_SECONDS, fields: ["count", "p50Us", "p90Us", "p99Us"] } as const;

/** A rung that dropped more than this is serving less than it was offered. */
const SATURATION = 0.01;

export function decode(b64: string): Uint32Array {
  const bytes = Buffer.from(b64, "base64");
  const out = new Uint32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = bytes.readUInt32LE(i * 4);
  return out;
}

/** The histogram on BIN_GRID. A request outside the grid is folded into its edge column, so the bins sum to the count. */
export function rebin(counts: ArrayLike<number>): number[] {
  const out = new Array<number>(BIN_GRID.count).fill(0);
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]!;
    if (c === 0) continue;
    const j = Math.trunc(Math.log10(Math.exp((i + 0.5) * LOG_GROWTH) / BIN_GRID.loUs) * BIN_GRID.perDecade);
    out[Math.min(BIN_GRID.count - 1, Math.max(0, j))]! += c;
  }
  return out;
}

/** A histogram on HIST_GRID with its empty ends cut off, so `counts[0]` is bucket `first`. */
export interface Hist {
  readonly first: number;
  readonly counts: readonly number[];
}

export function trim(counts: ArrayLike<number>): Hist {
  let first = 0;
  while (first < counts.length && counts[first] === 0) first++;
  if (first === counts.length) return { first: 0, counts: [] };
  let last = counts.length - 1;
  while (counts[last] === 0) last--;
  return { first, counts: Array.from({ length: last - first + 1 }, (_, i) => counts[first + i]!) };
}

const stats = (h: ArrayLike<number>) => ({ p50Us: pct(h, 50), p90Us: pct(h, 90), p99Us: pct(h, 99) });

export interface RungSummary {
  readonly rps: number;
  readonly status: PhaseResult["status"];
  /** Served everything it was offered, which is the only case a latency is published for. */
  readonly completed: boolean;
  readonly saturated: boolean;
  readonly achievedRps: number;
  readonly dropped: number;
  readonly errors: number;
  readonly mismatch: number;
  /** Over every request the rung recorded, which is the mix as it was sent. */
  readonly p50Us: number | null;
  readonly p90Us: number | null;
  readonly p99Us: number | null;
}

/** A closed-loop rung: what a function sustained answering one event at a time, with nothing offered or dropped. */
export interface ClosedRungSummary {
  readonly closed: true;
  readonly status: "done";
  readonly completed: true;
  /** The invocations a second the function sustained. */
  readonly achievedRps: number;
  readonly invocations: number;
  readonly errors: number;
  readonly mismatch: number;
  /** The invoke phase over every test. */
  readonly p50Us: number;
  readonly p90Us: number;
  readonly p99Us: number;
  /** The first invocation the recording timed, which with no settle is the function's first. */
  readonly first?: ClosedRecordedSummary["first"];
  /** Each second of the recording: its invocations and their mean invoke phase. */
  readonly perSecond?: ClosedRecordedSummary["perSecond"];
}

/**
 * A cache test's store at a rung: how often the handler ran, read from x-rb-serial, beside
 * `oneStore`, how often one store that keeps each answer `lifetimeSeconds` would run it, which is
 * its keys times the recorded seconds over the lifetime.
 */
export interface CacheRung extends CacheSummary {
  readonly lifetimeSeconds: number;
  readonly oneStore: number;
}

export const cacheRung = (cache: CacheSummary, seconds: number): CacheRung => ({
  ...cache,
  lifetimeSeconds: CACHE_LIFETIME_SECONDS,
  oneStore: (cache.keys * seconds) / CACHE_LIFETIME_SECONDS,
});

export interface TestRung extends ReturnType<typeof stats> {
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly bins: readonly number[];
  readonly hist: Hist;
  /** Each window of the recording on WINDOW_GRID, in order. Absent from a run the generator did not window. */
  readonly windows?: readonly Window[];
  /** For a cache test, how often its handler ran. Absent from a run the generator did not count. */
  readonly cache?: CacheRung;
}

/** The spans a closed-loop test publishes beside its invoke phase, which is its TestRung. */
export const SPANS = ["response", "responseLatency", "responseDuration", "runtimeOverhead"] as const;

export interface ClosedTestRung extends TestRung {
  readonly spans: Readonly<Record<(typeof SPANS)[number], ReturnType<typeof stats> & { readonly hist: Hist }>>;
}

type Latency = keyof ReturnType<typeof stats>;

/** `estimated` is how many of the family's tests the percentiles fill in, where there are any. */
type FamilyStats = { count: number } & ReturnType<typeof stats> & { estimated?: number };

/** What the families are read from: each framework's rungs, and its tests' percentiles at them. */
interface Measured {
  readonly rungs: Readonly<Record<string, { readonly completed: boolean }>>;
  readonly tests: Readonly<Record<string, { readonly family: string; readonly rungs: Readonly<Record<string, TestRung>> }>>;
}

/**
 * Each framework's families at each rung it completed: a family's count as its tests' summed, and
 * its p50, p90 and p99 as the geometric mean of its tests' own. A percentile of their histograms
 * merged would mostly say which test's band sits at that rank. Under a geometric mean a change of
 * 10% in any one test moves the family by the same amount, whatever the test's size.
 *
 * A mean over fewer tests moves with the size of the tests left out. So a test the framework has
 * no answers for, where another framework has, is filled in at the framework's ratio to the others
 * on the tests it has: exp(mean ln(x / r) over its tests + mean ln r over all of them). A test's r
 * is the geometric mean of its percentile over the frameworks that have answers for every test in
 * the family, or over those that have it where none has them all. With every test that is the
 * plain mean. `estimated` counts the tests filled in. A test no framework has answers for is left
 * out, and a family with none of its tests answered has 0, as each of those tests does.
 */
function familiesOf(frameworks: readonly Measured[]): Record<string, Record<string, FamilyStats>>[] {
  const at = (f: Measured, id: string, rn: string, k: Latency): number | null => {
    const x = f.tests[id]?.rungs[rn]?.[k];
    return x !== undefined && x > 0 ? x : null;
  };
  const members = new Map<string, Set<string>>();
  for (const f of frameworks) for (const [id, t] of Object.entries(f.tests)) members.set(t.family, (members.get(t.family) ?? new Set()).add(id));
  const refs = new Map<string, ReadonlyMap<string, number>>();
  /** Each of the family's tests some framework has answers for at the rung, with its r. */
  const refsOf = (rn: string, fam: string, k: Latency): ReadonlyMap<string, number> => {
    const key = `${rn} ${fam} ${k}`;
    const known = refs.get(key);
    if (known) return known;
    const answered = [...(members.get(fam) ?? [])].filter((id) => frameworks.some((f) => at(f, id, rn, k) !== null));
    const every = frameworks.filter((f) => answered.every((id) => at(f, id, rn, k) !== null));
    const out = new Map(
      answered.map((id) => {
        const xs = (every.length ? every : frameworks).flatMap((f) => at(f, id, rn, k) ?? []);
        return [id, Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length)];
      }),
    );
    refs.set(key, out);
    return out;
  };
  return frameworks.map((f) => {
    const out: Record<string, Record<string, FamilyStats>> = {};
    for (const [rn, rung] of Object.entries(f.rungs)) {
      if (!rung.completed) continue;
      const byFamily = new Map<string, string[]>();
      for (const [id, t] of Object.entries(f.tests)) if (t.rungs[rn]) byFamily.set(t.family, [...(byFamily.get(t.family) ?? []), id]);
      out[rn] = Object.fromEntries(
        [...byFamily].map(([fam, ids]): [string, FamilyStats] => {
          const mean = (k: Latency): number => {
            const r = refsOf(rn, fam, k);
            const own = [...r].flatMap(([id, ref]) => {
              const x = at(f, id, rn, k);
              return x === null ? [] : [Math.log(x / ref)];
            });
            if (!own.length) return 0;
            const all = [...r.values()].map((ref) => Math.log(ref));
            return Math.round(Math.exp(own.reduce((s, v) => s + v, 0) / own.length + all.reduce((s, v) => s + v, 0) / all.length));
          };
          const count = ids.reduce((s, id) => s + f.tests[id]!.rungs[rn]!.count, 0);
          const stats: FamilyStats = { count, p50Us: mean("p50Us"), p90Us: mean("p90Us"), p99Us: mean("p99Us") };
          const estimated = [...refsOf(rn, fam, "p50Us").keys()].filter((id) => at(f, id, rn, "p50Us") === null).length;
          return [fam, stats.p50Us > 0 && estimated > 0 ? { ...stats, estimated } : stats];
        }),
      );
    }
    return out;
  });
}

function openRungs(load: LoadResult | undefined) {
  const rungs: Record<string, RungSummary> = {};
  const tests: Record<string, { family: string; heft: Heft; rungs: Record<string, TestRung> }> = {};

  // The warmup records nothing and is not a rung.
  for (const [i, phase] of (load?.phases ?? []).entries()) {
    const declared = load!.load.phases[i]!;
    if (declared.seconds === undefined) continue;
    if (phase.status === "notRun") {
      rungs[phase.name] = { rps: phase.rps, status: "notRun", completed: false, saturated: false, achievedRps: 0, dropped: 0, errors: 0, mismatch: 0, p50Us: null, p90Us: null, p99Us: null };
      continue;
    }
    const r = phase.recorded;
    const scheduled = r?.scheduled ?? phase.settle?.scheduled ?? 0;
    const dropped = r?.dropped ?? phase.settle?.dropped ?? 0;
    const completed = phase.status === "done" && r !== undefined && r.dropped === 0;
    const overall = new Uint32Array(BUCKETS);
    if (completed) {
      for (const t of r.tests) {
        const h = decode(t.histB64);
        addInto(overall, h);
        const rung: TestRung = {
          count: t.count,
          errors: t.errors,
          mismatch: t.mismatch,
          ...stats(h),
          bins: rebin(h),
          hist: trim(h),
          ...(t.windows === undefined ? {} : { windows: t.windows }),
          ...(t.cache === undefined ? {} : { cache: cacheRung(t.cache, r.seconds) }),
        };
        (tests[t.id] ??= { family: t.family, heft: t.heft, rungs: {} }).rungs[phase.name] = rung;
      }
    }
    rungs[phase.name] = {
      rps: phase.rps,
      status: phase.status,
      completed,
      saturated: scheduled > 0 && dropped / scheduled > SATURATION,
      achievedRps: r?.achievedRps ?? phase.settle?.achievedRps ?? 0,
      dropped,
      errors: r?.errors ?? phase.settle?.errors ?? 0,
      mismatch: r?.mismatch ?? phase.settle?.mismatch ?? 0,
      p50Us: completed ? pct(overall, 50) : null,
      p90Us: completed ? pct(overall, 90) : null,
      p99Us: completed ? pct(overall, 99) : null,
    };
  }
  return { rungs, tests };
}

function closedRungs(load: ClosedResult) {
  const rungs: Record<string, ClosedRungSummary> = {};
  const tests: Record<string, { family: string; heft: Heft; rungs: Record<string, ClosedTestRung> }> = {};

  // The warmup records nothing and is not a rung.
  for (const phase of load.phases) {
    const r = phase.recorded;
    if (r === undefined) continue;
    const overall = new Uint32Array(BUCKETS);
    for (const t of r.tests) {
      const h = decode(t.invoke.histB64);
      addInto(overall, h);
      const spans = Object.fromEntries(
        SPANS.map((name) => {
          const s = decode(t[name].histB64);
          return [name, { ...stats(s), hist: trim(s) }];
        }),
      ) as ClosedTestRung["spans"];
      const rung: ClosedTestRung = {
        count: t.count,
        errors: t.errors,
        mismatch: t.mismatch,
        ...stats(h),
        bins: rebin(h),
        hist: trim(h),
        spans,
        ...(t.windows === undefined ? {} : { windows: t.windows }),
        ...(t.cache === undefined ? {} : { cache: cacheRung(t.cache, r.seconds) }),
      };
      (tests[t.id] ??= { family: t.family, heft: t.heft, rungs: {} }).rungs[phase.name] = rung;
    }
    rungs[phase.name] = {
      closed: true,
      status: phase.status,
      completed: true,
      achievedRps: r.invocationsPerSecond,
      invocations: r.invocations,
      errors: r.errors,
      mismatch: r.mismatch,
      p50Us: pct(overall, 50),
      p90Us: pct(overall, 90),
      p99Us: pct(overall, 99),
      ...(r.first === undefined ? {} : { first: r.first }),
      ...(r.perSecond === undefined ? {} : { perSecond: r.perSecond }),
    };
  }
  return { rungs, tests };
}

function summarizeFramework(f: FrameworkRun) {
  const meta = f.meta ?? {};
  const [language, name] = f.id.split(":") as [string, string];
  const { rungs, tests } = f.load !== undefined && isClosed(f.load) ? closedRungs(f.load) : openRungs(f.load);
  return {
    id: f.id,
    language,
    name,
    ordinal: f.ordinal,
    framework: typeof meta["framework"] === "string" ? meta["framework"] : name,
    version: typeof meta["version"] === "string" ? meta["version"] : "",
    runtime: typeof meta["runtime"] === "string" ? meta["runtime"] : "",
    meta,
    bundleHash: f.bundleHash,
    codeHash: f.codeHash,
    ...(f.boot === undefined ? {} : { boot: f.boot }),
    ...(f.gate === undefined ? {} : { gate: { measurable: f.gate.measurable, passed: f.gate.passed } }),
    ...(f.unsupported === undefined ? {} : { unsupported: f.unsupported }),
    ...(f.error === undefined ? {} : { error: f.error }),
    rungs,
    tests,
  };
}

export type Summary = ReturnType<typeof summarize>;

export function summarize(run: RunFile) {
  const frameworks = run.frameworks.map(summarizeFramework);
  const families = familiesOf(frameworks);
  return {
    runId: run.runId,
    date: run.started.slice(0, 10),
    host: run.host,
    recorded: run.recorded,
    notRecorded: run.notRecorded,
    commit: run.commit,
    repo: run.repo,
    ladder: run.ladder,
    corpusVersion: run.tests.corpusVersion,
    tests: { bundleHash: run.tests.bundleHash, codeHash: run.tests.codeHash },
    generator: run.generator,
    machine: run.machine,
    budget: run.budget,
    binGrid: BIN_GRID,
    histGrid: HIST_GRID,
    windowGrid: WINDOW_GRID,
    frameworks: frameworks.map((f, i) => ({ ...f, families: families[i]! })),
  };
}
