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
  type SiteView,
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
import { codeKey, DEFAULT_HOST, hostOf, pageSlug, rungsOf } from "./run.ts";
import type { Framework, Route, Run, WireDoc } from "./types.ts";

/**
 * Each test's own source, at the commit a run was made at, and whether it is the tests bundle that
 * run recorded. Null when history could not answer at that commit.
 */
export type TestsSource = { view: TestsView; verdict: Verdict; from: Source; unlinked: string | null } | null;

/** One framework page: a framework as the newest run on one host measured it. */
export type FrameworkPage = {
  slug: string;
  host: string;
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
  tests: TestsSource;
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
   * The corpus the tests pages describe, read where the routes are, and whether its files can be
   * linked. Those pages explain the tests rather than a run, so they need no bundle to verify.
   */
  corpus: { view: TestsView; repo: string; linkable: boolean } | null;
  catalog: Catalog;
  /** The runs embedded in the page, one per host, so the table paints without a round trip. */
  embedded: Run[];
  /** Every host's, from the newest run on that host. */
  pages: FrameworkPage[];
  /** codeKey's key to its code document, shipped next to the run it describes. */
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

/** The default host first, whose pages keep the names they had before there were others. */
const byHost = (a: Run, b: Run): number =>
  Number(hostOf(b) === DEFAULT_HOST) - Number(hostOf(a) === DEFAULT_HOST) || (hostOf(a) < hostOf(b) ? -1 : 1);

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

  // One read of history per host, at the commit its newest run was made at. A framework's code on
  // one host leaves out the other hosts' directories, so each host's pages need their own read.
  const views = new Map<string, SiteView | null>();
  const viewOf = (at: string | null, host: string): SiteView | null => {
    const key = `${at ?? "worktree"} ${host}`;
    if (views.has(key)) return views.get(key) ?? null;
    const sv = siteView(config.root, at, host);
    const how = `rb siteview ${at === null ? "--worktree" : `--at ${at}`} --host ${host}`;
    for (const w of sv.warnings) notes.push(`${how}: ${w}`);
    if (sv.why) notes.push(`${how}: ${sv.why}`);
    views.set(key, sv.view);
    return sv.view;
  };

  const newest = newestPerHost(runs).sort(byHost);
  const pages: FrameworkPage[] = [];
  const code: Site["code"] = {};
  let described: SiteView | null = null;
  for (const run of newest) {
    const host = hostOf(run);
    const at = run.commit || "HEAD";
    const view = viewOf(at, host);
    // A run made from a changed working tree recorded bundles no commit holds. Its commit cannot
    // show what it measured, and the working tree can, for as long as it has not changed since.
    const unverified =
      run.frameworks.some((f) => !verdictOf(view?.frameworks[f.id], f.bundleHash).verified) ||
      !verdictOf(view?.tests, run.tests?.bundleHash).verified;
    const tree = unverified ? viewOf(null, host) : null;
    // The routes are the working tree's corpus whichever tree is read, so a commit history cannot
    // answer for still has them. The sources are not: HEAD's file under an old run's number is the
    // thing the bundle hash is there to prevent, so they come only from a tree that verifies.
    described ??= view ?? tree ?? (at === "HEAD" ? null : viewOf("HEAD", host));

    // The first rate: the one every framework is expected to complete.
    const rn = rungsOf(run)[0] ?? "";
    const repo = run.repo || view?.repo || "";
    const commit = run.commit ?? "";
    const at12 = commit.slice(0, 12) || "this run's commit";
    const picked = pick(view?.tests, tree?.tests, run.tests?.bundleHash);
    const tests: TestsSource = picked.view
      ? { view: picked.view, verdict: picked.verdict, from: picked.from, unlinked: unlinkedWhy(picked.verdict, repo, commit, "The tests'", picked.from) }
      : null;
    const counts = { commit: 0, worktree: 0, changed: 0, none: 0 };
    for (const f of run.frameworks) {
      const chosen = pick(view?.frameworks[f.id], tree?.frameworks[f.id], f.bundleHash);
      counts[!chosen.view ? "none" : chosen.verdict.verified ? chosen.from : "changed"] += 1;
      pages.push({
        slug: pageSlug(f.language, f.name, host),
        host,
        run,
        framework: f,
        rn,
        view: chosen.view,
        verdict: chosen.verdict,
        from: chosen.from,
        unlinked: chosen.view
          ? unlinkedWhy(chosen.verdict, repo, commit, "The framework's", chosen.from)
          : `${f.id} is neither at ${at12} nor in the working tree, so its source is unavailable.`,
        tests,
        repo,
        commit,
      });
      // The handler for a row is the thing a reader wants when they open that row, so it
      // travels with the numbers rather than living only on the page.
      if (chosen.view) code[codeKey(f.id, host)] = snippetDoc(chosen.view, repo, commit, chosen.verdict.linkable);
    }
    const where = (from: Source, verified: boolean) =>
      from === "commit" ? `from ${at12}${verified ? "" : ", unverified"}` : `from the working tree${verified ? "" : ", changed since the run"}`;
    notes.push(
      `wrote ${run.frameworks.length} framework page(s) on ${host}: code from ${at12} for ${counts.commit}, from the ` +
        `working tree for ${counts.worktree}, from a working tree changed since the run for ${counts.changed}, none ` +
        `for ${counts.none}; test sources ${picked.view ? where(picked.from, picked.verdict.verified) : "unavailable"}`,
    );
  }
  // With no run the corpus is still read, at HEAD, because the routes and factors ride in the
  // page whatever results it shows.
  if (newest.length === 0) described = viewOf("HEAD", DEFAULT_HOST);
  const corpus = described?.tests ?? null;
  const routes = routesOf(corpus);
  const factors = factorsOf(corpus);

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
    corpus: described ? { view: described.tests, repo: described.repo, linkable: described.tests.pushed && described.repo !== "" } : null,
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
      pages: pagesByHost(pages),
    },
  };
}

/** Each host's pages, by framework, as the explorer looks a row's page up. */
function pagesByHost(pages: readonly FrameworkPage[]): PageData["pages"] {
  const out: PageData["pages"] = {};
  for (const p of pages) (out[p.host] ??= {})[p.framework.id] = `f/${p.slug}.html`;
  return out;
}
