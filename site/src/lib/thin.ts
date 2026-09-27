// Thin percentiles: a percentile is thin when fewer than THIN of the requests it is read from lie
// beyond it, such as a p99 over fewer than 1,000 requests or a p90 over fewer than 100. The site
// shows it all the same, and marks it.
//
// A family's or a profile's percentile is the geometric mean of its tests' own, so it is read from
// all of their requests. The requests beyond each test's own percentile add up, and the mean is
// thin only when their total is under THIN, however thin each test's is.

/** Fewer requests than this beyond a percentile leave it thin. */
export const THIN = 10;

const LEVEL: Readonly<Record<string, number>> = { p50Us: 50, p90Us: 90, p99Us: 99 };

/** How many of `count` requests lie beyond the percentile `metric` names. Null for a metric that is no percentile, or no requests. */
export function beyond(count: number | null | undefined, metric: string): number | null {
  const q = LEVEL[metric];
  if (q === undefined || !count || count < 0) return null;
  return Math.floor((count * (100 - q)) / 100);
}

export function isThin(count: number | null | undefined, metric: string): boolean {
  const n = beyond(count, metric);
  return n !== null && n < THIN;
}

/** What a thin value rests on, as a pane writes it beside the percentile's name. Its title says the rest. */
export const beyondLabel = (n: number): string => (n === 0 ? "none beyond" : `${n.toLocaleString()} beyond`);

/** Why a value is marked, as its title says it. `level` is p50, p90 or p99. */
export function thinTitle(count: number | null | undefined, metric: string, level: string): string {
  const n = beyond(count, metric) ?? 0;
  const of = `of its ${(count ?? 0).toLocaleString()} requests`;
  return n === 0
    ? `Thin: none ${of} lie beyond this ${level}.`
    : `Thin: ${n.toLocaleString()} ${of} ${n === 1 ? "lies" : "lie"} beyond this ${level}, fewer than ${THIN}.`;
}
