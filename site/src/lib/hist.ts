// What the site leaves out of a run: the generator's histogram a summary carries for each test,
// and each test's windows.
//
// The histograms are most of a summary's bytes, and nothing on the site reads them: a profile is
// read from each test's percentiles. The framework pages draw the windows when the site is built,
// and nothing in the browser reads them.

type RawRung = Record<string, unknown> & { hist?: unknown; windows?: unknown };
type RawTest = Record<string, unknown> & { rungs?: Record<string, RawRung> };
type RawFramework = Record<string, unknown> & { tests?: Record<string, RawTest> };

/**
 * A summary without its histograms or windows, which is the copy the page carries and the build
 * publishes. It takes the document as it was read, and leaves every other key where it was.
 */
export function withoutHist<T>(raw: T): T {
  if (typeof raw !== "object" || raw === null) return raw;
  const doc = raw as { frameworks?: RawFramework[] };
  if (!Array.isArray(doc.frameworks)) return raw;
  const frameworks = doc.frameworks.map((f) => {
    if (!f.tests) return f;
    const tests = Object.fromEntries(
      Object.entries(f.tests).map(([id, t]) => {
        if (!t.rungs) return [id, t];
        const rungs = Object.fromEntries(
          Object.entries(t.rungs).map(([rn, rung]) => {
            const { hist: _, windows: __, ...rest } = rung;
            return [rn, rest];
          }),
        );
        return [id, { ...t, rungs }];
      }),
    );
    return { ...f, tests };
  });
  return { ...doc, frameworks } as T;
}
