// The catalog: what results exist, and where each document is.
//
// One document describing the whole data set, published next to the data rather than baked
// into the page, so the explorer can be pointed at a results site it was not built against.
// Every `file` is relative to the catalog's own URL, which is what makes the set relocatable:
// move the directory, or serve it from another origin, and the links still resolve.
//
// It lists the runs the site shows and no others. The build decides which those are, recorded
// runs unless it was asked for the rest, so a page never has to.
import { z } from "zod";
import { DEFAULT_HOST, hostOf, languagesOf } from "./run.ts";
import type { Run, WireDoc } from "./types.ts";

export const CATALOG_VERSION = 1;
export const CATALOG_NAME = "catalog.json";

export const RunEntry = z.object({
  id: z.string(),
  file: z.string(),
  date: z.string().default(""),
  languages: z.array(z.string()).default([]),
  host: z.string().default(DEFAULT_HOST),
  ladder: z.string().default(""),
  /** The corpus version: two runs are read against each other only when it matches. */
  corpus: z.string().default(""),
  recorded: z.boolean().default(false),
  cpu: z.string().default(""),
  cores: z.number().default(0),
});
export type RunEntry = z.infer<typeof RunEntry>;

export const Catalog = z.object({
  version: z.literal(CATALOG_VERSION),
  generated: z.string().default(""),
  runs: z.array(RunEntry).default([]),
  wire: z.record(z.string(), z.object({ framework: z.string().default(""), file: z.string() })).default({}),
  code: z.record(z.string(), z.object({ file: z.string() })).default({}),
});
export type Catalog = z.infer<typeof Catalog>;

/** A run id is a timestamp with punctuation a file name should not carry. */
export const slug = (runId: string): string => runId.replaceAll(":", "").replaceAll("/", "-");

/** Just enough to populate the controls and decide what to fetch. */
export const runEntry = (r: Run): RunEntry => ({
  id: r.runId,
  file: `${slug(r.runId)}.json.gz`,
  date: r.date ?? "",
  languages: languagesOf(r),
  host: hostOf(r),
  ladder: r.ladder ?? "",
  corpus: r.corpusVersion ?? "",
  recorded: Boolean(r.recorded),
  cpu: r.machine?.cpu ?? "",
  cores: r.machine?.cores ?? 0,
});

/** Code documents are per framework, keyed `<language>:<name>`, filed by `-`. */
export const codeFile = (key: string): string => `code/${key.replaceAll(":", "-")}.json.gz`;
export const wireFile = (key: string): string => `wire/${key}.json.gz`;

export function buildCatalog(runs: Run[], wire: Record<string, WireDoc>, codeKeys: Iterable<string>, generated: string): Catalog {
  return {
    version: CATALOG_VERSION,
    generated,
    runs: runs.map(runEntry),
    wire: Object.fromEntries(Object.entries(wire).map(([k, v]) => [k, { framework: v.framework, file: wireFile(k) }])),
    code: Object.fromEntries([...codeKeys].map((k) => [k, { file: codeFile(k) }])),
  };
}

/** A version hash as a reader can compare it: the first twelve hex digits. */
export const shortHash = (v: string): string => v.replace(/^sha256:/, "").slice(0, 12);

/**
 * Which ladder and corpus the page is showing, and how many runs it is showing.
 *
 * Read from the catalog rather than written here, because a page whose results live on
 * another site has no runs at build time and would otherwise say "no runs" above a table of
 * them.
 */
export function provenance(catalog: Catalog): { eyebrow: string; runs: number } {
  const ladders = [...new Set(catalog.runs.map((r) => r.ladder).filter(Boolean))].sort();
  const corpora = [...new Set(catalog.runs.map((r) => r.corpus).filter(Boolean))].map(shortHash).sort();
  return {
    eyebrow: ladders.length ? `${ladders.join(" + ")} · corpus ${corpora.join(", ")}` : "no runs",
    runs: catalog.runs.length,
  };
}

/**
 * The newest run per host.
 *
 * These are embedded in the page so the table paints without a round trip. Embedding every
 * run would make the page grow without bound.
 */
export function newestPerHost(runs: Run[]): Run[] {
  const newest = new Map<string, Run>();
  for (const r of runs) {
    const h = hostOf(r);
    const cur = newest.get(h);
    if (!cur || r.runId > cur.runId) newest.set(h, r);
  }
  return [...newest.values()];
}
