// What a framework page's numbers are compared with.
//
// Two kinds of thing. The base is each endpoint's own, from spec/endpoints.json: the same
// target with one factor taken away, and its numbers ride in the page. Any other target in
// the run measured the same endpoint on the same machine in the same window, so its numbers
// read directly against this one's. Those are read from the run's document in the data
// directory, and only once a reader picks one.
//
// Pure, so it is tested rather than looked at. The DOM half is in endpoint-tree.ts.
import type { EndpointRung, FamilyRecord, Run, Target } from "../lib/types.js";
import { famsAt } from "./select.js";

/** The base, which a page opens on. */
export const BASE = "base";

/** One per categorical colour after the page's own teal: --s1 to --s5. */
export const MAX = 5;

/**
 * One thing the page is compared with: `base`, or another target's page name. `slot` is its
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

export const dropPick = (picks: readonly Pick[], id: string): Pick[] =>
  picks.filter((x) => x.id !== id);

/** A target in the run, by the name of its framework page. */
export const targetOf = (run: Run, id: string): Target | undefined =>
  run.targets.find((t) => `${t.language}-${t.target}` === id);

/**
 * A rate the target did not complete has no latencies. The summary still carries family
 * percentiles there, taken over whatever survived the collapse, and reading them would flatter
 * it, so neither kind of record is read at that rate.
 */
const finished = (t: Target, rn: string): boolean => t.rungs[rn]?.completed !== false;

export function endpointAt(t: Target, eid: string, rn: string): EndpointRung | undefined {
  return finished(t, rn) ? t.endpoints?.[eid]?.rungs?.[rn] : undefined;
}

export function familyAt(t: Target, fam: string, rn: string): FamilyRecord | undefined {
  return finished(t, rn) ? famsAt(t, rn)[fam] : undefined;
}

/** One statistic off a record, or null when the record does not carry it as a number. */
export function statOf(rec: EndpointRung | FamilyRecord | undefined, k: string): number | null {
  const v = (rec as Record<string, unknown> | undefined)?.[k];
  return typeof v === "number" ? v : null;
}
