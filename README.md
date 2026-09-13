# RequestBench results

Data only. No workflow watches this branch for code, so a nightly measurement does not
trigger CI or add commits to `main`'s history.

`summary/<run_id>.json` is one measurement run: ratios to that shard's bare baseline, the
machine it ran on, and per-family breakdowns. A few kilobytes each, kept forever.

Raw samples — a histogram per endpoint per rung, megabytes per run — are not here. They
live in the `measure` workflow's build artifacts with 90-day retention.

Written by the `collect` job in `.github/workflows/measure.yml`. Read by
`site/build.py`, which renders https://ipjohnson.github.io/RequestBench.

A run is only written here when it ran the full five-rung ladder; a shortened ladder is a
smoke test and is marked `tracked: false` upstream and never uploaded.
