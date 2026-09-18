# site

The results explorer, and one page per framework. An Astro app in the workspace, static
output, two hydrated islands.

    node site/tools/build.js --summaries <dir> --exemplars <dir> --out <dir> [--data-base <url>]

`make site SUMMARIES=_results/summary` is the same thing. `--summaries` may be left out.

## Layout

    src/lib/          build and browser both. No DOM, no Node-only code below config.ts
      types.ts        what a summary and an exemplar look like, as zod schemas
      load.ts         reading the two input directories
      catalog.ts      what results exist and where each document is
      delta.ts        the base chain: one implementation, used by both kinds of page
      views.ts        the delta cell, likewise, and the base's row on a pane
      site.ts         everything the build reads, read once
      bundleview.ts   the harness/siteview.py seam
    src/client/       the browser. Bundled and type-checked
      source.ts       where results are read from
      select.ts       run to rows: pure, so the table is tested rather than looked at
      explorer.ts     the DOM half of the explorer
      compare.ts      what a framework page is compared with: pure, like select.ts
      endpoint-tree.ts  the DOM half of a framework page
    src/pages/        index.astro, and f/[slug].astro per target
    src/styles/       the palette and the two stylesheets
    tools/build.js    the CLI

## Two authorities, one page

The generator owns the endpoints, the factors, the host notes and the framework pages; those
come out of `spec/` and out of this repository's history, and they ride in the page.

The results own the runs, the wire captures and the handler documents; those grow by a run a
night and are addressed through a catalog. The catalog names every document relative to itself,
so the whole set can be served from anywhere. Three things can say where, in this order:

1. `?data=<url>` on the page.
2. `<meta name="rb:data">`, written from `--data-base`.
3. `data/`, the directory this build writes.

A cross-origin base needs that origin to allow the read; GitHub Pages sends
`Access-Control-Allow-Origin: *`.

## The Python seam

`harness/siteview.py` reads each target's bundle manifest and locates its handlers in git
history at the commit a run recorded. It stays Python because `snippets.py` is the only
authority on where a handler starts and ends: `make snippets` and the gate in `validate.yml`
call the same function, and a second implementation here would be a second answer. The site
runs it once per build and parses what it prints.

A build with no Python, or against history that does not hold the commit, still renders. Every
framework page then says its source is unavailable, which is what it should say, and the build
prints why.

## Checks

    npm --prefix site test          # vitest
    npm --prefix site run typecheck # astro check
    npm run lint                    # eslint, type-aware over site/**/*.ts
