// Latency histograms in microseconds, laid out the way gen/blend.mjs lays them out upstream, so
// a histogram published by either reads the same.

/** Each bucket is 2% wider than the one before it, so a percentile read off one is within 2%. */
export const GROWTH = 1.02;
export const LOG_GROWTH = Math.log(GROWTH);

/** 1.02^920 is about 80 seconds, and anything slower lands in the last bucket. */
export const BUCKETS = 920;

export const bucketOf = (us: number): number =>
  us <= 1 ? 0 : Math.min(BUCKETS - 1, Math.floor(Math.log(us) / LOG_GROWTH));

const midpoint = (bucket: number): number => Math.exp((bucket + 0.5) * LOG_GROWTH);

export function countOf(hist: Uint32Array): number {
  let total = 0;
  for (const n of hist) total += n;
  return total;
}

export function percentile(hist: Uint32Array, p: number): number {
  const total = countOf(hist);
  if (total === 0) return 0;
  const want = Math.ceil((p / 100) * total);
  let seen = 0;
  for (let i = 0; i < hist.length; i++) {
    seen += hist[i]!;
    if (seen >= want) return Math.round(midpoint(i));
  }
  return Math.round(midpoint(hist.length - 1));
}

export function addInto(into: Uint32Array, from: Uint32Array): void {
  for (let i = 0; i < into.length; i++) into[i] = into[i]! + from[i]!;
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
 *
 * The summary and the site's blends both read percentiles with this, so a blend of every test
 * gives the rung's own number.
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
