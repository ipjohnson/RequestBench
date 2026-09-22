// What a summary lists without saying so: its rungs, its tests and its languages.
//
// `rb summarize` keys every statistic by name inside each framework and writes no list beside
// them, so the lists are read off the frameworks. Both kinds of page need them, which is why
// they are here rather than in the browser's select.ts.
import type { FamilyRecord, Framework, Run } from "./types.ts";

/** The host a run without one was measured on, which is the only host there has been. */
export const DEFAULT_HOST = "container-h1";

export const hostOf = (run: Run): string => run.host || DEFAULT_HOST;

/**
 * The rungs in the order the ladder offered them. A summary writes each framework's rungs in
 * phase order, so the first framework to name a rung places it. A framework that failed before
 * it was measured names none.
 */
export function rungsOf(run: Run | null): string[] {
  if (!run) return [];
  const out = new Set<string>();
  for (const f of run.frameworks) for (const rn of Object.keys(f.rungs ?? {})) out.add(rn);
  return [...out];
}

/**
 * Every test any framework in the run measured, in id order. The generator measures in id
 * order and a family's tests share its prefix, so this keeps a family's tests together.
 */
export function testOrder(run: Run): string[] {
  const out = new Set<string>();
  for (const f of run.frameworks) for (const id of Object.keys(f.tests ?? {})) out.add(id);
  return [...out].sort();
}

export const languagesOf = (run: Run): string[] => [...new Set(run.frameworks.map((f) => f.language))].sort();

/** A test's family as the run recorded it, or its id's prefix where no framework measured it. */
export const familyOf = (run: Run, id: string): string =>
  run.frameworks.map((f) => f.tests?.[id]?.family).find(Boolean) ?? id.split(".")[0] ?? id;

/** A framework's families at one rung. A rung it did not complete has none. */
export const famsAt = (f: Framework, rn: string): Record<string, FamilyRecord> => f.families?.[rn] ?? {};

/** A value from /__meta, where it is a string. */
export function metaOf(f: Framework, key: string): string {
  const v = f.meta?.[key];
  return typeof v === "string" ? v : "";
}
