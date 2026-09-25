// What a summary lists without saying so: its rungs, its tests and its languages.
//
// `rb summarize` keys every statistic by name inside each framework and writes no list beside
// them, so the lists are read off the frameworks. Both kinds of page need them, which is why
// they are here rather than in the browser's select.ts.
import type { FamilyRecord, Framework, Run, Rung } from "./types.ts";

/** The host a run without one was measured on, which was the only host there was. */
export const DEFAULT_HOST = "container-h1";

export const hostOf = (run: Run): string => run.host || DEFAULT_HOST;

/**
 * A framework page's name. The default host's pages keep the names they had before there were
 * other hosts, so links to them still open.
 */
export const pageSlug = (language: string, name: string, host: string): string =>
  host === DEFAULT_HOST ? `${language}-${name}` : `${language}-${name}@${host}`;

/** A framework's code document on a host, keyed as its page is named. */
export const codeKey = (id: string, host: string): string => (host === DEFAULT_HOST ? id : `${id}@${host}`);

/** A rung as a button or a column names it: its offered rate, or the closed loop that offers none. */
export const rungLabel = (r: Rung | undefined): string => (r?.closed ? "closed loop" : `${(r?.rps ?? 0).toLocaleString()} rps`);

/** The machine a run was measured on, as the explorer names it: its CPU model and core count. */
export const machineOf = (run: Run): string => `${run.machine?.cpu || "unknown CPU"}, ${run.machine?.cores ?? "?"} cores`;

/**
 * The runs a time axis may join with `newest`: measured on `machine`, on the same rate ladder and
 * against the same corpus version. The same framework on another CPU can differ by twice, and a
 * run on another ladder or corpus measured something else.
 */
export function timeline(runs: readonly Run[], newest: Run, machine: string): Run[] {
  return runs.filter(
    (r) => machineOf(r) === machine && r.ladder === newest.ladder && r.corpusVersion === newest.corpusVersion,
  );
}

/** Each machine with runs `newest` can be read against, and how many: the newest run's first, then the most runs. */
export function machinesFor(runs: readonly Run[], newest: Run): { machine: string; runs: number }[] {
  const counts = new Map<string, number>();
  for (const r of runs) {
    if (r.ladder !== newest.ladder || r.corpusVersion !== newest.corpusVersion) continue;
    const m = machineOf(r);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const own = machineOf(newest);
  return [...counts]
    .map(([machine, n]) => ({ machine, runs: n }))
    .sort((a, b) => Number(b.machine === own) - Number(a.machine === own) || b.runs - a.runs || (a.machine < b.machine ? -1 : 1));
}

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

const LANGUAGE_NAMES: Record<string, string> = { dotnet: ".NET", go: "Go", java: "Java", node: "Node", python: "Python", rust: "Rust" };

/** A language as a sentence names it. One missing from LANGUAGE_NAMES keeps its directory's name. */
export const languageName = (language: string): string => LANGUAGE_NAMES[language] ?? language;

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
