// Everything the build reads, read once.
//
// Astro imports each page module separately, so this is memoised: the summaries are parsed,
// the exemplars are trimmed and `rb siteview` is run once for the whole build rather than once
// per page.
import {
  pick,
  siteView,
  snippetDoc,
  unlinkedWhy,
  verdictOf,
  type CodeEntry,
  type FrameworkView,
  type Source,
  type TestsView,
  type Verdict,
} from "./bundleview.ts";
import { buildCatalog, newestPerHost, type Catalog } from "./catalog.ts";
import { buildConfig, type BuildConfig } from "./config.ts";
import { factorsOf, hostNotes, routesOf } from "./corpus.ts";
import { withoutHist } from "./hist.ts";
import { loadExemplars, loadRuns, staleExemplars } from "./load.ts";
import type { PageData } from "./page-data.ts";
import { DEFAULT_HOST, hostOf, rungsOf } from "./run.ts";
import type { Framework, Route, Run, WireDoc } from "./types.ts";

/** One framework page: a framework as the newest run on the page host measured it. */
export type FrameworkPage = {
  slug: string;
  run: Run;
  framework: Framework;
  /** The first rate, the one every framework is expected to complete. */
  rn: string;
  view: FrameworkView | null;
  verdict: Verdict;
  /** Where the code was read: the run's commit, or the working tree the run was made from. */
  from: Source;
  /** Why the page's code carries no links, or why there is no code, when either is so. */
  unlinked: string | null;
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
  families: Record<string, { about: string; comparable: string }>;
  /**
   * Each test's own source, at the commit the pages describe, and whether it is the tests
   * bundle that run recorded. Null when history could not answer at that commit.
   */
  tests: { view: TestsView; verdict: Verdict; from: Source; unlinked: string | null } | null;
  catalog: Catalog;
  /** The runs embedded in the page, one per host, so the table paints without a round trip. */
  embedded: Run[];
  pages: FrameworkPage[];
  /** "<language>:<name>" to its code document, shipped next to the run it describes. */
  code: Record<string, Record<string, CodeEntry>>;
  pageData: PageData;
  notes: string[];
};

// On globalThis rather than in a module variable. Astro compiles the pages through Vite and
// loads the config and its integrations through a second graph, so each gets its own copy of
// this module; a per-module memo ran siteview twice, once for the pages and once for the data
// directory, and the two disagreed about the catalog's timestamp.
const MEMO = Symbol.for("rb.site");
type Memo = { [MEMO]?: Site };

export function site(): Site {
  const g = globalThis as Memo;
  return (g[MEMO] ??= read());
}

/**
 * A framework page describes one framework as one run measured it, and its name carries no
 * host, so it is generated from one host alone. The other hosts need a name of their own
 * before they can have a page.
 */
export const PAGE_HOST = DEFAULT_HOST;

function newestOn(runs: Run[], host: string): Run | null {
  let newest: Run | null = null;
  for (const r of runs) {
    if (hostOf(r) !== host) continue;
    if (!newest || r.runId > newest.runId) newest = r;
  }
  return newest;
}

function read(): Site {
  const config = buildConfig();
  const notes: string[] = [];

  const loaded = config.summaries ? loadRuns(config.summaries) : { runs: [], raw: new Map<string, unknown>(), rejected: [] };
  for (const r of loaded.rejected) notes.push(`skipping ${r.file}: ${r.why}`);
  const runs = config.unrecorded ? loaded.runs : loaded.runs.filter((r) => r.recorded);
  const left = loaded.runs.length - runs.length;
  if (left) notes.push(`left out ${left} run(s) that were not recorded; --unrecorded shows them`);

  const wire = loadExemplars(config.exemplars);
  const stale = staleExemplars(runs, wire);
  if (stale.length)
    notes.push(
      `${stale.length} exemplar file(s) match no test in any run and will show no exchange; ` +
        `recapture with \`npm run rb -- validate <framework> --exemplars\`: ${stale.join(", ")}`,
    );

  // One read of history, at the commit the pages describe. With no run the corpus is still
  // read, at HEAD, because the routes and factors ride in the page whatever results it shows.
  const newest = newestOn(runs, PAGE_HOST);
  const at = newest?.commit || "HEAD";
  const sv = siteView(config.root, at);
  for (const w of sv.warnings) notes.push(`rb siteview: ${w}`);
  if (sv.why) notes.push(`no site view at ${at}: ${sv.why}`);
  const view = sv.view;
  // A run made from a changed working tree recorded bundles no commit holds. Its commit cannot
  // show what it measured, and the working tree can, for as long as it has not changed since.
  const unverified =
    newest !== null &&
    (newest.frameworks.some((f) => !verdictOf(view?.frameworks[f.id], f.bundleHash).verified) ||
      !verdictOf(view?.tests, newest.tests?.bundleHash).verified);
  const tv = unverified ? siteView(config.root, null) : null;
  for (const w of tv?.warnings ?? []) notes.push(`rb siteview --worktree: ${w}`);
  if (tv?.why) notes.push(`no site view of the working tree: ${tv.why}`);
  const tree = tv?.view ?? null;
  // The routes are the working tree's corpus whichever tree is read, so a commit history cannot
  // answer for still has them. The sources are not: HEAD's file under an old run's number is the
  // thing the bundle hash is there to prevent, so they come only from a tree that verifies.
  const corpus = view?.tests ?? tree?.tests ?? (at === "HEAD" ? null : (siteView(config.root, "HEAD").view?.tests ?? null));
  const routes = routesOf(corpus);
  const factors = factorsOf(corpus);

  const pages: FrameworkPage[] = [];
  const code: Site["code"] = {};
  let tests: Site["tests"] = null;
  if (newest) {
    // The first rate: the one every framework is expected to complete.
    const rn = rungsOf(newest)[0] ?? "";
    const repo = newest.repo || view?.repo || "";
    const commit = newest.commit ?? "";
    const at12 = commit.slice(0, 12) || "this run's commit";
    const counts = { commit: 0, worktree: 0, changed: 0, none: 0 };
    for (const f of newest.frameworks) {
      const chosen = pick(view?.frameworks[f.id], tree?.frameworks[f.id], f.bundleHash);
      counts[!chosen.view ? "none" : chosen.verdict.verified ? chosen.from : "changed"] += 1;
      pages.push({
        slug: `${f.language}-${f.name}`,
        run: newest,
        framework: f,
        rn,
        view: chosen.view,
        verdict: chosen.verdict,
        from: chosen.from,
        unlinked: chosen.view
          ? unlinkedWhy(chosen.verdict, repo, commit, "The framework's", chosen.from)
          : `${f.id} is neither at ${at12} nor in the working tree, so its source is unavailable.`,
        repo,
        commit,
      });
      // The handler for a row is the thing a reader wants when they open that row, so it
      // travels with the numbers rather than living only on the page.
      if (chosen.view) code[f.id] = snippetDoc(chosen.view, repo, commit, chosen.verdict.linkable);
    }
    const chosen = pick(view?.tests, tree?.tests, newest.tests?.bundleHash);
    if (chosen.view) {
      tests = {
        view: chosen.view,
        verdict: chosen.verdict,
        from: chosen.from,
        unlinked: unlinkedWhy(chosen.verdict, repo, commit, "The tests'", chosen.from),
      };
    }
    const where = (from: Source, verified: boolean) =>
      from === "commit" ? `from ${at12}${verified ? "" : ", unverified"}` : `from the working tree${verified ? "" : ", changed since the run"}`;
    notes.push(
      `wrote ${pages.length} framework page(s): code from ${at12} for ${counts.commit}, from the working tree for ` +
        `${counts.worktree}, from a working tree changed since the run for ${counts.changed}, none for ${counts.none}; ` +
        `test sources ${chosen.view ? where(chosen.from, chosen.verdict.verified) : "unavailable"}`,
    );
  }

  const catalog = buildCatalog(runs, wire, Object.keys(code), new Date().toISOString());
  const embedded = newestPerHost(runs).map(withoutHist);

  return {
    config,
    runs,
    raw: loaded.raw,
    wire,
    routes,
    factors,
    families: corpus?.families ?? {},
    tests,
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
      pages: Object.fromEntries(pages.map((p) => [p.framework.id, `f/${p.slug}.html`])),
    },
  };
}
