// The generator's histograms a summary carries for each test, and where the site keeps them.
//
// They are most of a summary's bytes, and only a blend other than All reads them. The build
// publishes them as a document of their own beside the run, and the page carries the run without
// them. The explorer fetches the document when a blend needs it and puts each histogram back
// where the summary had it.
import { BUCKETS, GROWTH } from "../../../traffic-generator/histogram.ts";
import type { Hist, Run } from "./types.ts";

/** By framework id, then test id, then rung. */
export type HistDoc = Record<string, Record<string, Record<string, Hist>>>;

/** Whether a run's histograms are counted on the grid this page reads percentiles on. */
export const histUsable = (run: Run): boolean => run.histGrid?.growth === GROWTH && run.histGrid.count === BUCKETS;

export const hasHist = (run: Run): boolean =>
  run.frameworks.some((f) => Object.values(f.tests).some((t) => Object.values(t.rungs ?? {}).some((r) => r.hist !== undefined)));

type RawRung = Record<string, unknown> & { hist?: Hist };
type RawTest = Record<string, unknown> & { rungs?: Record<string, RawRung> };
type RawFramework = Record<string, unknown> & { id?: string; tests?: Record<string, RawTest> };

/**
 * A summary split into the run without its histograms and the histograms. It takes the document
 * as it was read, which is what the build publishes, and leaves every other key where it was.
 */
export function splitHist(raw: unknown): { run: unknown; hist: HistDoc } {
  const hist: HistDoc = {};
  if (typeof raw !== "object" || raw === null) return { run: raw, hist };
  const doc = raw as { frameworks?: RawFramework[] };
  if (!Array.isArray(doc.frameworks)) return { run: raw, hist };
  const frameworks = doc.frameworks.map((f) => {
    if (!f.tests) return f;
    const tests = Object.fromEntries(
      Object.entries(f.tests).map(([id, t]) => {
        if (!t.rungs) return [id, t];
        const rungs = Object.fromEntries(
          Object.entries(t.rungs).map(([rn, rung]) => {
            const { hist: h, ...rest } = rung;
            if (h && f.id) ((hist[f.id] ??= {})[id] ??= {})[rn] = h;
            return [rn, rest];
          }),
        );
        return [id, { ...t, rungs }];
      }),
    );
    return { ...f, tests };
  });
  return { run: { ...doc, frameworks }, hist };
}

/** The run without its histograms, which is the copy the page carries. */
export const withoutHist = (run: Run): Run => splitHist(run).run as Run;

/** Each histogram put back on the test and rung it came from. */
export function attachHist(run: Run, doc: HistDoc): void {
  for (const f of run.frameworks) {
    for (const [id, byRung] of Object.entries(doc[f.id] ?? {})) {
      for (const [rn, h] of Object.entries(byRung)) {
        const rung = f.tests[id]?.rungs?.[rn];
        if (rung) rung.hist = h;
      }
    }
  }
}
