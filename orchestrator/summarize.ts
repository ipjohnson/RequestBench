// A run file collapsed into what the site reads and keeps: per test and per rung the
// percentiles, a coarse histogram and the generator's own histogram, per family the same merged,
// and per rung what was offered, achieved and dropped. A port of upstream's harness/summarize.py.
//
// Nothing is divided by anything. A rung a framework did not complete publishes what it
// achieved and dropped and no latency: the generator drops by never sending, so percentiles
// over what survived would flatter the frameworks that collapse hardest.
import { BUCKETS, GROWTH, LOG_GROWTH, pct } from "../traffic-generator/histogram.ts";
import type { PhaseResult } from "../traffic-generator/load.ts";
import type { FrameworkRun, RunFile } from "./measure.ts";

/**
 * The coarse grid a page draws a distribution on: eight bins a decade from 80 µs reaches 600 ms
 * in 31 columns, wide enough to tell two apart on screen. Changing it changes what a summary
 * means, so it is written into every summary rather than agreed out of band.
 */
export const BIN_GRID = { loUs: 80, perDecade: 8, count: 31 } as const;

/**
 * The generator's grid, which each test's `hist` is counted on: bucket i starts at growth^i µs.
 * A page merges these histograms to read the percentiles of a blend of tests, so the grid is
 * written into every summary like BIN_GRID.
 */
export const HIST_GRID = { growth: GROWTH, count: BUCKETS } as const;

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
  readonly p90Us: number | null;
  readonly p99Us: number | null;
  readonly p999Us: number | null;
}

export interface TestRung extends ReturnType<typeof stats> {
  readonly count: number;
  readonly errors: number;
  readonly mismatch: number;
  readonly bins: readonly number[];
  readonly hist: Hist;
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
      rungs[phase.name] = { rps: phase.rps, status: "notRun", completed: false, saturated: false, achievedRps: 0, dropped: 0, errors: 0, mismatch: 0, p50Us: null, p90Us: null, p99Us: null, p999Us: null };
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
          hist: trim(h),
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
      p90Us: completed ? pct(overall, 90) : null,
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
    ...(f.unsupported === undefined ? {} : { unsupported: f.unsupported }),
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
    histGrid: HIST_GRID,
    frameworks: run.frameworks.map(summarizeFramework),
  };
}
