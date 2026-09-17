// The catalog: what results exist, and where each document is.
//
// One document describing the whole data set, published next to the data rather than baked
// into the page, so the explorer can be pointed at a results site it was not built against.
// Every `file` is relative to the catalog's own URL, which is what makes the set relocatable:
// move the directory, or serve it from another origin, and the links still resolve.
import { z } from "zod";
import type { Run, WireDoc } from "./types.js";

export const CATALOG_VERSION = 1;
export const CATALOG_NAME = "catalog.json";

export const RunEntry = z.object({
  id: z.string(),
  file: z.string(),
  date: z.string().default(""),
  languages: z.array(z.string()).default([]),
  exec_host: z.string().default("container"),
  suite: z.string().default(""),
  epoch: z.string().default(""),
  tracked: z.boolean().default(false),
  cpu: z.string().default(""),
  cores: z.number().default(0),
});
export type RunEntry = z.infer<typeof RunEntry>;

export const Catalog = z.object({
  version: z.literal(CATALOG_VERSION),
  generated: z.string().default(""),
  runs: z.array(RunEntry).default([]),
  wire: z
    .record(z.string(), z.object({ framework: z.string().default(""), version: z.string().default(""), file: z.string() }))
    .default({}),
  code: z.record(z.string(), z.object({ file: z.string() })).default({}),
});
export type Catalog = z.infer<typeof Catalog>;

/** A run id is a timestamp with punctuation a file name should not carry. */
export const slug = (runId: string): string => runId.replaceAll(":", "").replaceAll("/", "-");

/** Just enough to populate the controls and decide what to fetch. */
export const runEntry = (r: Run): RunEntry => ({
  id: r.run_id,
  file: `${slug(r.run_id)}.json.gz`,
  date: r.date ?? "",
  languages: r.languages ?? [],
  exec_host: r.exec_host || "container",
  suite: r.suite ?? "",
  epoch: r.epoch === undefined ? "" : String(r.epoch),
  tracked: Boolean(r.tracked),
  cpu: r.cpu ?? "",
  cores: r.cores ?? 0,
});

/** Handler documents are per target, keyed `<language>:<target>`, filed by `-`. */
export const codeFile = (key: string): string => `code/${key.replaceAll(":", "-")}.json.gz`;
export const wireFile = (key: string): string => `wire/${key}.json.gz`;

export function buildCatalog(
  runs: Run[],
  wire: Record<string, WireDoc>,
  codeKeys: Iterable<string>,
  generated: string,
): Catalog {
  return {
    version: CATALOG_VERSION,
    generated,
    runs: runs.map(runEntry),
    wire: Object.fromEntries(
      Object.entries(wire).map(([k, v]) => [
        k,
        { framework: v.framework, version: v.version, file: wireFile(k) },
      ]),
    ),
    code: Object.fromEntries([...codeKeys].map((k) => [k, { file: codeFile(k) }])),
  };
}

/**
 * Which endpoint set the page is showing, and how many runs it is showing.
 *
 * Read from the catalog rather than written here: a hardcoded name kept saying blend-v1 for a
 * page built entirely from blend-v2 runs. The catalog and not the build, because a page whose
 * results live on another site has no runs at build time and would otherwise say "no runs"
 * above a table of twenty-eight.
 */
export function provenance(catalog: Catalog): { eyebrow: string; runs: number } {
  const tracked = catalog.runs.filter((r) => r.tracked);
  const suites = [...new Set(tracked.map((r) => r.suite).filter(Boolean))].sort();
  const epochs = [...new Set(tracked.map((r) => r.epoch).filter(Boolean))].sort();
  return {
    eyebrow: suites.length ? `${suites.join(" + ")} \u00b7 epoch ${epochs.join(", ")}` : "no runs",
    runs: tracked.length,
  };
}

/**
 * The newest tracked run per host.
 *
 * These are embedded in the page so the table paints without a round trip. Embedding every
 * run made the page grow without bound, one full-matrix run being close to a megabyte.
 */
export function newestPerHost(runs: Run[]): Run[] {
  const newest = new Map<string, Run>();
  for (const r of runs) {
    if (!r.tracked) continue;
    const h = r.exec_host || "container";
    const cur = newest.get(h);
    if (!cur || r.run_id > cur.run_id) newest.set(h, r);
  }
  return [...newest.values()];
}
