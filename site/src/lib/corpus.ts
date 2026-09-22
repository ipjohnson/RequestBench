// What the tests are and what each host is, straight from the corpus and the orchestrator,
// rather than restated here.
import { HOSTS } from "../../../orchestrator/hosts.ts";
import type { TestsView } from "./bundleview.ts";
import type { HostNote, Route } from "./types.ts";

/**
 * Method, route and base edge per test id, for a framework page's tests and the explorer's
 * delta column.
 *
 * The summary carries ids and families but never the route, and an id alone does not say what
 * was asked for. A few dozen short strings, so they ride in the page rather than being fetched.
 *
 * `b` and `v` are the base and the factor varied from it. They come from the corpus rather
 * than the run because a run records what was measured and never why two tests are a pair,
 * and a delta that named the wrong pair would be wrong in a way no number shows. A run older
 * than the current corpus loses its deltas where the pairing moved, which is correct: the
 * pairing it was measured under is not this one.
 */
export function routesOf(tests: TestsView | null): Record<string, Route> {
  const out: Record<string, Route> = {};
  for (const [id, t] of Object.entries(tests?.tests ?? {})) {
    const row: Route = { m: t.method ?? "", p: t.path ?? "" };
    if (t.base !== undefined && t.varies !== undefined) {
      row.b = t.base;
      row.v = t.varies;
    }
    out[id] = row;
  }
  return out;
}

/** What each factor reads as, so the delta is a sentence rather than two ids. */
export const factorsOf = (tests: TestsView | null): Record<string, string> =>
  Object.fromEntries(Object.entries(tests?.factors ?? {}).map(([k, v]) => [k, v.reads]));

/** What a host is, from the orchestrator's own record of it. */
export const hostNotes = (): Record<string, HostNote> =>
  Object.fromEntries(Object.values(HOSTS).map((h) => [h.id, { note: h.about }]));
