// Everything the build reads, read once.
//
// Astro imports each page module separately, so this is memoised: the summaries are parsed,
// the exemplars are trimmed and harness/siteview.py is run once for the whole build rather
// than once per page.
import { siteView, snippetDoc, verdictOf, type TargetView } from "./bundleview.js";
import { buildCatalog, newestPerHost, type Catalog } from "./catalog.js";
import { buildConfig, type BuildConfig } from "./config.js";
import { loadExemplars, loadRuns, staleExemplars } from "./load.js";
import type { PageData } from "./page-data.js";
import { hostNotes, readSpec, specFactors, specRoutes } from "./spec.js";
import type { Route, Run, Target, WireDoc } from "./types.js";

/** One framework page: a target as the newest tracked run on the container host measured it. */
export type FrameworkPage = {
  slug: string;
  run: Run;
  target: Target;
  /** The first rate, the one every target is expected to complete. */
  rn: string;
  view: TargetView | null;
  verified: boolean;
  linkable: boolean;
  repo: string;
  commit: string;
};

export type Site = {
  config: BuildConfig;
  runs: Run[];
  /** Each run as its file held it, which is what the data directory publishes. */
  raw: Map<string, unknown>;
  wire: Record<string, WireDoc>;
  routes: Record<string, Route>;
  factors: Record<string, string>;
  catalog: Catalog;
  /** The runs embedded in the page, one per host, so the table paints without a round trip. */
  embedded: Run[];
  pages: FrameworkPage[];
  /** "<language>:<target>" to its handler document, shipped next to the run it describes. */
  code: Record<string, ReturnType<typeof snippetDoc>>;
  pageData: PageData;
  notes: string[];
};

// On globalThis rather than in a module variable. Astro compiles the pages through Vite and
// loads the config and its integrations through a second graph, so each gets its own copy of
// this module; a per-module memo ran harness/siteview.py twice, once for the pages and once
// for the data directory, and the two disagreed about the catalog's timestamp.
const MEMO = Symbol.for("rb.site");
type Memo = { [MEMO]?: Site };

export function site(): Site {
  const g = globalThis as Memo;
  return (g[MEMO] ??= read());
}

/**
 * A framework page describes one target as one run measured it, and its name carries no host,
 * so it is generated from the container host alone. Generating every host into the same name
 * meant the last one written won: go-gin's page reported lambda-rie, a host with no HTTP in
 * the process. The other hosts need a name of their own before they can have a page.
 */
function newestContainerRun(runs: Run[]): Run | null {
  let newest: Run | null = null;
  for (const r of runs) {
    if (!r.tracked || (r.exec_host || "container") !== "container") continue;
    if (!newest || r.run_id > newest.run_id) newest = r;
  }
  return newest;
}

function read(): Site {
  const config = buildConfig();
  const notes: string[] = [];

  const loaded = config.summaries
    ? loadRuns(config.summaries)
    : { runs: [], raw: new Map<string, unknown>(), rejected: [], stale: 0 };
  for (const r of loaded.rejected) notes.push(`skipping ${r.file}: ${r.why}`);
  if (loaded.stale)
    notes.push(`skipped ${loaded.stale} summary file(s) older than the keyed endpoint shape`);
  const runs = loaded.runs;

  const wire = loadExemplars(config.exemplars);
  const stale = staleExemplars(runs, wire);
  if (stale.length)
    notes.push(
      `${stale.length} exemplar capture(s) match no endpoint in any run and will show no ` +
        `payload; recapture with \`make exemplars\`: ${stale.join(", ")}`,
    );

  const spec = readSpec();
  const routes = specRoutes(spec);
  const factors = specFactors(spec);

  const newest = newestContainerRun(runs);
  const pages: FrameworkPage[] = [];
  const code: Site["code"] = {};
  if (newest) {
    // The first rate: the one every target is expected to complete. Picking the middle of the
    // list gave the raised rate once the ladder became two, so a target that could not sustain
    // it had no number on its own page.
    const rn = newest.rungs.length ? String(newest.rungs[0]) : "1";
    const keys = newest.targets.map((t) => `${t.language}:${t.target}`);
    const view = siteView(keys, newest.commit ?? "");
    if (view.why) notes.push(`no bundle view: ${view.why}`);
    const repo = newest.repo || view.repo;
    const commit = newest.commit ?? "";
    let unavailable = 0;
    for (const t of newest.targets) {
      const key = `${t.language}:${t.target}`;
      const tv = view.targets[key] ?? null;
      const { verified, linkable } = verdictOf(tv, t.bundle_hash);
      if (!verified) unavailable += 1;
      pages.push({
        slug: `${t.language}-${t.target}`,
        run: newest,
        target: t,
        rn,
        view: tv,
        verified,
        linkable,
        repo,
        commit,
      });
      // The handler for a row is the thing a reader wants when they open that row, so it
      // travels with the numbers rather than living only on the page.
      if (tv) code[key] = snippetDoc(tv, repo, commit, linkable);
    }
    notes.push(
      `wrote ${pages.length} framework page(s)` +
        (unavailable ? `; ${unavailable} could not verify their bundle against history` : ""),
    );
  }

  const catalog = buildCatalog(runs, wire, Object.keys(code), new Date().toISOString());
  const embedded = newestPerHost(runs);

  return {
    config,
    runs,
    raw: loaded.raw,
    wire,
    routes,
    factors,
    catalog,
    embedded,
    pages,
    code,
    notes,
    pageData: {
      boot: { catalog, runs: embedded },
      hosts: hostNotes(),
      routes,
      factors,
      pages: Object.fromEntries(pages.map((p) => [`${p.target.language}:${p.target.target}`, `f/${p.slug}.html`])),
    },
  };
}
