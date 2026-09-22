// The coarse latency grid `rb summarize` counts `bins` on, and the arithmetic both drawings of
// it need.
//
// The grid travels in the summary rather than being agreed here, so a page labels its axis
// from the run it is drawing. Everything below takes that grid as given.
import type { BinGrid, TestRecord } from "./types.ts";

/** The lower edge of bin j, in microseconds. Bin j covers [edge(j), edge(j + 1)). */
export const binEdge = (grid: BinGrid, j: number): number => grid.loUs * 10 ** (j / grid.perDecade);

/** Microseconds as a reader says them: under a millisecond in us, past it in ms. */
export function usLabel(v: number): string {
  if (v < 1000) return `${Math.round(v)} us`;
  const ms = v / 1000;
  return `${ms < 10 && !Number.isInteger(ms) ? ms.toFixed(1) : Math.round(ms)} ms`;
}

/**
 * The bins something actually landed in, across every test at one rate.
 *
 * The grid reaches 600 ms because one framework needs it there. Drawing all of it on a
 * framework that finishes inside a millisecond would spend most of the width on nothing, and
 * drawing each test to its own span would rescale the axis under a reader stepping through
 * them. One span per framework per rate is the middle: tests stay comparable, empty width does
 * not.
 */
export function usedSpan(
  tests: Record<string, TestRecord>,
  ids: string[],
  rn: string,
): { c0: number; c1: number; n: number } | null {
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const id of ids) {
    const bins = tests[id]?.rungs?.[rn]?.bins;
    if (!bins) continue;
    for (let j = 0; j < bins.length; j += 1) {
      if (!bins[j]) continue;
      if (j < c0) c0 = j;
      if (j > c1) c1 = j;
    }
  }
  return c1 < c0 ? null : { c0, c1, n: c1 - c0 + 1 };
}

/**
 * Where a latency sits across a span drawn `width` wide, measured from `left`.
 *
 * The bins are uniform in log space, so this is exact rather than snapped to a column. It
 * has to be: the grid starts at 80 us, so no bin edge is ever a round decade and a tick
 * placed on the nearest edge would sit a third of a column off where it says it is.
 */
export function scaleFor(grid: BinGrid, c0: number, c1: number, left: number, width: number) {
  const lg0 = Math.log10(binEdge(grid, c0));
  const lg1 = Math.log10(binEdge(grid, c1 + 1));
  const decades: number[] = [];
  for (let d = Math.ceil(lg0); d <= Math.floor(lg1); d += 1) decades.push(10 ** d);
  return {
    decades,
    x: (v: number): number => left + ((Math.log10(v) - lg0) / (lg1 - lg0)) * width,
  };
}
