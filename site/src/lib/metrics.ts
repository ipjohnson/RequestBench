// The metrics the explorer can rank on, and how a number of each is written.
//
// Shared with the framework pages, which have no metric selector and read p50, so the two
// kinds of page format one number the same way.

export type MetricId = "p50_us" | "p90_us" | "p99_us" | "p999_us" | "achieved_rps" | "dropped";

export const METRICS: Record<MetricId, { label: string; unit: "us" | "" }> = {
  p50_us: { label: "p50", unit: "us" },
  p90_us: { label: "p90", unit: "us" },
  p99_us: { label: "p99", unit: "us" },
  p999_us: { label: "p99.9", unit: "us" },
  achieved_rps: { label: "achieved rps", unit: "" },
  dropped: { label: "dropped", unit: "" },
};

export const isMetric = (s: string): s is MetricId => s in METRICS;

export type Unit = "us" | "B" | "";

export function withUnit(v: number, unit: Unit): string {
  const n = Math.round(v).toLocaleString();
  return unit === "us" ? `${n} us` : unit === "B" ? `${n} B` : n;
}

/** A missing number is an em dash: the run did not measure it, which is not a zero. */
export function cell(v: number | string | null | undefined, unit: Unit = ""): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return withUnit(v, unit);
}

export const signed = (v: number, unit: Unit): string =>
  (v > 0 ? "+" : v < 0 ? "−" : "±") + withUnit(Math.abs(v), unit);
