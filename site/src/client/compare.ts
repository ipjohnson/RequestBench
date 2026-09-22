// What a framework page's numbers are compared with.
//
// Two kinds of thing. The base is each test's own, from the corpus: the same framework with one
// factor taken away, and its numbers ride in the page. Any other framework in the run measured
// the same test on the same machine in the same window, so its numbers read directly against
// this one's. Those are read from the run's document in the data directory, and only once a
// reader picks one.
//
// Pure, so it is tested rather than looked at. The DOM half is in test-tree.ts.
import { famsAt } from "../lib/run.ts";
import type { FamilyRecord, Framework, Run, TestRung } from "../lib/types.ts";

/** The base, which a page opens on. */
export const BASE = "base";

/** One per categorical colour after the page's own teal: --s1 to --s5. */
export const MAX = 5;

/**
 * One thing the page is compared with: `base`, or another framework's page name. `slot` is its
 * colour, kept for as long as it is picked, so removing one does not repaint the rest.
 */
export type Pick = { id: string; slot: number };

/**
 * The comparison in a page's query, in the order it was picked. No `vs` at all is the base
 * alone; an empty one is nothing, which is what a reader who removed the base asked for.
 */
export function readVs(search: string, known: ReadonlySet<string>): Pick[] {
  const p = new URLSearchParams(search);
  if (!p.has("vs")) return known.has(BASE) ? [{ id: BASE, slot: 1 }] : [];
  const ids = [...new Set(p.getAll("vs"))].filter((id) => known.has(id)).slice(0, MAX);
  return ids.map((id, i) => ({ id, slot: i + 1 }));
}

/** The query with this comparison in it, and nothing written for the default. */
export function writeVs(search: string, picks: readonly Pick[]): string {
  const p = new URLSearchParams(search);
  p.delete("vs");
  if (!(picks.length === 1 && picks[0]?.id === BASE)) {
    for (const x of picks) p.append("vs", x.id);
    if (!picks.length) p.set("vs", "");
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

/** `id` added at the end, in the lowest colour free. Unchanged when full or already there. */
export function addPick(picks: readonly Pick[], id: string): Pick[] {
  if (picks.length >= MAX || picks.some((x) => x.id === id)) return [...picks];
  const used = new Set(picks.map((x) => x.slot));
  let slot = 1;
  while (used.has(slot)) slot += 1;
  return [...picks, { id, slot }];
}

export const dropPick = (picks: readonly Pick[], id: string): Pick[] => picks.filter((x) => x.id !== id);

/** A framework in the run, by the name of its framework page. */
export const frameworkOf = (run: Run, page: string): Framework | undefined =>
  run.frameworks.find((f) => `${f.language}-${f.name}` === page);

/**
 * A rate the framework did not complete has no latencies. Neither kind of record is read at
 * that rate, so a number taken over whatever survived the collapse is never shown.
 */
const finished = (f: Framework, rn: string): boolean => f.rungs[rn]?.completed !== false;

export function testAt(f: Framework, id: string, rn: string): TestRung | undefined {
  return finished(f, rn) ? f.tests?.[id]?.rungs?.[rn] : undefined;
}

export function familyAt(f: Framework, fam: string, rn: string): FamilyRecord | undefined {
  return finished(f, rn) ? famsAt(f, rn)[fam] : undefined;
}

/** One statistic off a record, or null when the record does not carry it as a number. */
export function statOf(rec: TestRung | FamilyRecord | undefined, k: string): number | null {
  const v = (rec as Record<string, unknown> | undefined)?.[k];
  return typeof v === "number" ? v : null;
}
