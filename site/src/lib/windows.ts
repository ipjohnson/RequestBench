// Each test's windows: its count and percentiles in each stretch of its recording, as
// `rb summarize` lays a window out, and the axis a test's windows are drawn on.
import type { WindowGrid } from "./types.ts";

/** Where a window keeps each number the chart reads, found by name in the grid the summary wrote. */
export type WindowPlaces = { count: number; p50: number; p90: number; p99: number };

/** A summary's windows, as the chart reads them. */
export type Windowing = { seconds: number; places: WindowPlaces };

/** Null when the summary has no windows, or lays them out without a number the chart reads. */
export function windowingOf(grid: WindowGrid | undefined): Windowing | null {
  if (!grid) return null;
  const at = (field: string): number => grid.fields.indexOf(field);
  const places = { count: at("count"), p50: at("p50Us"), p90: at("p90Us"), p99: at("p99Us") };
  return Object.values(places).every((i) => i >= 0) ? { seconds: grid.seconds, places } : null;
}

/**
 * The latencies a test's windows fall between, from its lowest p50 to its highest p99, with a
 * tenth of a decade to spare at either end so no line runs along the frame. The axis is the
 * test's own, because the chart is read for how the test moved rather than against other tests,
 * and it is a decade tall at least, so a test that barely moves is not drawn as if it swung.
 */
export function windowSpan(windows: readonly (readonly number[])[], places: WindowPlaces): { lo: number; hi: number } | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const w of windows) {
    if (!w[places.count]) continue;
    lo = Math.min(lo, w[places.p50] ?? Infinity);
    hi = Math.max(hi, w[places.p99] ?? -Infinity);
  }
  if (!(lo > 0) || !(hi >= lo)) return null;
  let l0 = Math.log10(lo) - 0.1;
  let l1 = Math.log10(hi) + 0.1;
  if (l1 - l0 < 1) {
    const mid = (l0 + l1) / 2;
    l0 = mid - 0.5;
    l1 = mid + 0.5;
  }
  return { lo: 10 ** l0, hi: 10 ** l1 };
}

/**
 * Round latencies to label a log axis from `lo` to `hi` with: the decades when three of them fall
 * inside, and otherwise the ones and threes, or the ones, twos and fives, whichever first gives
 * three.
 */
export function logTicks(lo: number, hi: number): number[] {
  const from = Math.floor(Math.log10(lo));
  const to = Math.ceil(Math.log10(hi));
  let out: number[] = [];
  for (const steps of [[1], [1, 3], [1, 2, 5]]) {
    out = [];
    for (let d = from; d <= to; d += 1) {
      for (const s of steps) {
        const v = s * 10 ** d;
        if (v >= lo && v <= hi) out.push(v);
      }
    }
    if (out.length >= 3) return out;
  }
  return out;
}
