# RequestBench results

Data only. No workflow watches this branch for code, so a nightly measurement does not
trigger CI or add commits to `main`'s history.

`runs/<month>/<run id>.json` is one run's summary, as `rb summarize` writes it. The `record`
job in `.github/workflows/measure.yml` adds the summary of each host a measurement ran on, and
the `pages` workflow builds https://ipjohnson.github.io/RequestBench from every file under
`runs/`.

`summary/` holds the summaries of the harness the rewrite replaced. The site does not read them.
