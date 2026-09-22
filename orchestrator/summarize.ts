// A run file collapsed into what the site reads and keeps: per test and per rung the
// percentiles and a coarse histogram, per family the same merged, and per rung what was offered,
// achieved and dropped. A port of upstream's harness/summarize.py.
//
// Nothing is divided by anything. A rung a framework did not complete publishes what it
// achieved and dropped and no latency: the generator drops by never sending, so percentiles
// over what survived would flatter the frameworks that collapse hardest.
import { BUCKETS, LOG_GROWTH } from "../traffic-generator/histogram.ts";
import type { PhaseResult } from "../traffic-generator/load.ts";
import type { FrameworkRun, RunFile } from "./measure.ts";

/**
 * The coarse grid a page draws a distribution on: eight bins a decade from 80 µs reaches 600 ms
 * in 31 columns, wide enough to tell two apart on screen. Changing it changes what a summary
 * means, so it is written into every summary rather than agreed out of band.
 */
export const BIN_GRID = { loUs: 80, perDecade: 8, count: 31 } as const;

/** A rung that dropped more than this is serving less than it was offered. */
const SATURATION = 0.01;

export function decode(b64: string): Uint32Array {
  const bytes = Buffer.from(b64, "base64");
  const out = new Uint32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = bytes.readUInt32LE(i * 4);
  return out;
}

/** Python's round, which takes a half to the even side, as upstream's summaries were written. */
const roundHalfEven = (x: number): number => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

/**
 * The p-th percentile, placed inside its bucket rather than at its middle. A midpoint puts every
 * percentile on a grid 2% apart, which is invisible in one number and decides the answer as
 * soon as two are subtracted, as every delta on a framework page is.
 */
export function pct(counts: ArrayLike<number>, p: number): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i]!;
  if (total === 0) return 0;
  const want = (p / 100) * total;
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]!;
    if (c > 0 && seen + c >= want) {
      const lo = Math.exp(i * LOG_GROWTH);
      const hi = Math.exp((i + 1) * LOG_GROWTH);
      return roundHalfEven(lo + (hi - lo) * Math.min(1, Math.max(0, (want - seen) / c)));
    }
    seen += c;
  }
  return 0;
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

const stats = (h: ArrayLike<number>) => ({ p50Us: pct(h, 50), p90Us: pct(h, 90), p95Us: pct(h, 95), p99Us: pct(h, 99), p999Us: pct(h, 99.9) });

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
  readonly p50Us: number | null;
  readonly p99Us: number | null;
  readonly p999Us: number | null;
}

export interface TestRung extends ReturnType<typeof stats> {
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly bins: readonly number[];
}

function summarizeFramework(f: FrameworkRun) {
  const meta = f.meta ?? {};
  const [language, name] = f.id.split(":") as [string, string];
  const rungs: Record<string, RungSummary> = {};
  const tests: Record<string, { family: string; rungs: Record<string, TestRung> }> = {};
  const families: Record<string, Record<string, { count: number; p50Us: number; p90Us: number; p99Us: number; p999Us: number }>> = {};

  // The warmup records nothing and is not a rung.
  for (const [i, phase] of (f.load?.phases ?? []).entries()) {
    const declared = f.load!.load.phases[i]!;
    if (declared.seconds === undefined) continue;
    if (phase.status === "notRun") {
      rungs[phase.name] = { rps: phase.rps, status: "notRun", completed: false, saturated: false, achievedRps: 0, dropped: 0, errors: 0, mismatch: 0, p50Us: null, p99Us: null, p999Us: null };
      continue;
    }
    const r = phase.recorded;
    const scheduled = r?.scheduled ?? phase.settle?.scheduled ?? 0;
    const dropped = r?.dropped ?? phase.settle?.dropped ?? 0;
    const completed = phase.status === "done" && r !== undefined && r.dropped === 0;
    const overall = new Uint32Array(BUCKETS);
    const byFamily = new Map<string, Uint32Array>();
    if (completed) {
      for (const t of r.tests) {
        const h = decode(t.histB64);
        for (let b = 0; b < BUCKETS; b++) overall[b]! += h[b]!;
        const fam = byFamily.get(t.family) ?? new Uint32Array(BUCKETS);
        for (let b = 0; b < BUCKETS; b++) fam[b]! += h[b]!;
        byFamily.set(t.family, fam);
        (tests[t.id] ??= { family: t.family, rungs: {} }).rungs[phase.name] = {
          count: t.count,
          errors: t.errors,
          mismatch: t.mismatch,
          ...stats(h),
          bins: rebin(h),
        };
      }
      families[phase.name] = Object.fromEntries(
        [...byFamily].map(([fam, h]) => {
          const s = stats(h);
          return [fam, { count: h.reduce((a, b) => a + b, 0), p50Us: s.p50Us, p90Us: s.p90Us, p99Us: s.p99Us, p999Us: s.p999Us }];
        }),
      );
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
      p99Us: completed ? pct(overall, 99) : null,
      p999Us: completed ? pct(overall, 99.9) : null,
    };
  }

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
    ...(f.error === undefined ? {} : { error: f.error }),
    rungs,
    tests,
    families,
  };
}

export type Summary = ReturnType<typeof summarize>;

export function summarize(run: RunFile) {
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
    frameworks: run.frameworks.map(summarizeFramework),
  };
}
