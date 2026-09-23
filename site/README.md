# site

The results explorer, and one page per framework. An Astro app in the workspace, static
output, two hydrated islands. A port of upstream's site/ at 9939f4c onto the rewrite's run
summaries, exemplars and `rb siteview`.

    npm run site -- --summaries <dir> [--exemplars <dir>] [--out <dir>] [--data-base <url>] [--unrecorded]

`--exemplars` defaults to results/exemplars and `--out` to site/dist. `--summaries` may be left
out, which builds the explorer with no data of its own.

A summary is what `npm run rb -- summarize <run file> --out <file>` writes. The site shows
recorded runs only unless `--unrecorded` is given, and every run made off Linux, from a changed
working tree, from an unpushed commit or with shortened rungs is unrecorded. So a local run is
looked at with:

    npm run rb -- summarize results/runs/<run>.json --out results/summary/<run>.json
    npm run site -- --summaries results/summary --unrecorded

## Layout

    src/lib/          build and browser both, no DOM. config, load, site and bundleview are the build's alone
      types.ts        what a summary and an exemplar file look like, as zod schemas
      config.ts       what tools/build.ts asked for, from the environment
      run.ts          the rungs, tests and languages a summary lists without saying so
      load.ts         reading the two input directories
      catalog.ts      what results exist and where each document is
      blends.ts       the named blends, and a blend read off its tests' merged histograms
      hist.ts         the per-test histograms, published beside a run rather than in it
      delta.ts        the base chain: one implementation, used by both kinds of page
      views.ts        the delta cell, likewise, and the base's row on a pane
      corpus.ts       routes and factors from the corpus, host notes from orchestrator/hosts.ts
      site.ts         everything the build reads, read once
      bundleview.ts   the `rb siteview` seam
    src/client/       the browser. Bundled and type-checked
      source.ts       where results are read from
      select.ts       run to rows: pure, so the table is tested rather than looked at
      explorer.ts     the DOM half of the explorer
      compare.ts      what a framework page is compared with: pure, like select.ts
      test-tree.ts    the DOM half of a framework page
    src/pages/        index.astro, and f/[slug].astro per framework
    src/styles/       the palette and the two stylesheets
    tools/build.ts    the CLI

## Two authorities, one page

The generator owns the routes, the factors, the host notes and the framework pages; those come
out of the corpus and out of this repository's history, and they ride in the page.

The results own the runs, the wire captures and the code documents; those grow by a run a
night and are addressed through a catalog. The catalog lists the runs the site shows and names
every document relative to itself, so the whole set can be served from anywhere. Three things
can say where, in this order:

1. `?data=<url>` on the page.
2. `<meta name="rb:data">`, written from `--data-base`.
3. `data/`, the directory this build writes.

A cross-origin base needs that origin to allow the read; GitHub Pages sends
`Access-Control-Allow-Origin: *`.

## The siteview seam

`npm run rb -- siteview --at <commit>` reads each framework's bundle, snippets and rb.json, and
each test's source, from history at the commit a run recorded. The build runs it once, at the
newest run's commit, and parses what it prints. It stays a subprocess because
orchestrator/snippets.ts is the only authority on where a handler starts and ends, and because
the corpus it reads loads its payloads from beside its own source, which a module bundled into
Astro's build scratch cannot do.

Verification decides what a page links and what it says about the code, never whether the code
is shown. A page shows the commit's files when they hash to the bundle the run recorded, and
links them when the commit is pushed. Otherwise it runs `rb siteview --worktree` and shows the
working tree's files. A run made from a changed working tree recorded bundles no commit holds,
and the working tree is exactly what it measured until the tree changes. The page says which it
is showing, and whether the files have changed since the run. Working-tree files are never
linked, because no commit holds them. Only a framework found in neither has no code, and its
page says the source is unavailable.

The wire panes read `results/exemplars`, which `npm run rb -- validate --exemplars` writes, in a
container or against a framework started by hand with `--at host:port --framework <id>`.

`astro dev` reads the same things from the environment that tools/build.ts puts there:

    RB_SUMMARIES=$PWD/results/summary RB_UNRECORDED=1 npm run dev -w @rb/site

## Checks

    npm test -w @rb/site        # node:test, also part of the root npm test
    npm run typecheck -w @rb/site
