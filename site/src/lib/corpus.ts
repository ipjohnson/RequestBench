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

/** A family as the tests pages list it: its tests in reading order, and how many are measured. */
export type FamilyEntry = { name: string; about: string; comparable: string; ids: string[]; measured: number };

/**
 * Every family in the corpus's order, each with its tests in reading order: a test comes after
 * the test it is read against when that one is in the same family, siblings by id. A page read
 * top to bottom then reaches each base before the tests that name it.
 */
export function familiesOf(tests: TestsView): FamilyEntry[] {
  const ids = Object.keys(tests.tests).sort();
  return Object.entries(tests.families).map(([name, f]) => {
    const own = ids.filter((id) => tests.tests[id]?.family === name);
    const inFamily = new Set(own);
    const under = new Map<string, string[]>();
    const roots: string[] = [];
    for (const id of own) {
      const base = tests.tests[id]?.base;
      if (base !== undefined && inFamily.has(base)) under.set(base, [...(under.get(base) ?? []), id]);
      else roots.push(id);
    }
    const order: string[] = [];
    const visit = (id: string): void => {
      if (order.includes(id)) return;
      order.push(id);
      for (const next of under.get(id) ?? []) visit(next);
    };
    // The suite refuses a loop of bases, so the roots reach every test. The second pass is for a
    // corpus that has one anyway, which would otherwise lose its tests from the page.
    for (const id of [...roots, ...own]) visit(id);
    const measured = order.filter((id) => tests.tests[id]?.kind === "performance").length;
    return { name, about: f.about, comparable: f.comparable, ids: order, measured };
  });
}

/** Each test that others are read against, and those others, by id. */
export function readAgainst(tests: TestsView): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [id, t] of Object.entries(tests.tests).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (t.base !== undefined) out.set(t.base, [...(out.get(t.base) ?? []), id]);
  }
  return out;
}

/** Where a family's page is, from a page at the site's root or from one a directory below it. */
export const familyPage = (family: string, from: "root" | "below"): string =>
  `${from === "root" ? "" : "../"}tests/${family}.html`;
