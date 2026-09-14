# Running measurements out of band

Validation runs on every pull request. Measurement does not: validation proves every target
still answers all 40 endpoints identically, and a timing taken while other jobs share the
runner is not worth keeping.

## What the schedule does

`.github/workflows/measure.yml` fires one cron at 02:00 UTC and fans out over execution
hosts. A job is one host, and it holds every implemented target in every language that host
supports, so every run is cross-language by construction. `harness/hosts.py` resolves a host
to its target list and its suite, both out of `spec/matrix.json`.

    python3 harness/hosts.py --list                # every host, and how much it holds
    python3 harness/hosts.py --host lambda-rie     # what that job would measure

The container host gets the rate ladder. A function host runs one invocation at a time and
has no knee to find, so it gets the pinned serial sequence instead.

Runs join the `measure-<ref>` concurrency group with `cancel-in-progress: false`, so a
second run queues behind the first rather than sharing a machine with it.

## The runner

Jobs run on `ubuntu-latest`. Each target container gets `RB_CPUS` cores, default 2, pinned
to `RB_SUT_CPUS`, and the load generator is pinned to `RB_GEN_CPUS` so it is not competing
with the target for the same cores.

That is still a shared machine that nothing calibrates. Ratios within a single run divide
the machine out and are the point; the absolute numbers are not admissible under the plan's
own rules, for the reasons `README.md` lists.

## What a run leaves behind

Raw samples, one histogram per endpoint per rung, are gzipped into a build artifact with
90-day retention. A summary of a few kilobytes goes to `summary/<month>/` on the orphan
`results` branch, holding ratios rather than absolutes; that is the durable series the site
reads. That branch carries no `.github` directory, so recording a run triggers nothing.

Only a full run is recorded. Passing `seconds` marks the run a smoke test, and its summary
is neither uploaded nor committed, so a short run cannot contaminate the series.

## Running one by hand

    gh workflow run measure.yml -f hosts='["container"]' -f seconds=15

`hosts` is a JSON array and defaults to every host that has targets. `seconds` overrides the
rung duration and applies to the blend suite only. `count` sets how many requests of the
pinned sequence the serial suite replays.

## Keeping the measured versions current

`.github/workflows/deps.yml` fires at 09:00 UTC, after `measure` starts at 02:00 with its
300 minute cap, so a merge never lands mid-measurement. One leg per manifest --
`targets/node`, `targets/go`, `targets/java` -- each cutting `deps/<language>` fresh from
`origin/main`, updating in place, and checking only that the manifest still installs and
compiles. Scope is patch and minor; a major changes the wiring, which is hand-written.

Conformance is deliberately not run there. The gate is `validate.yml` on the pull request,
which boots every target and fingerprints all 40 endpoints. A second job watches those
checks so the scheduled run goes red when an update breaks one.

Opening that pull request needs a `DEPS_TOKEN` secret, a fine-grained token with Contents
and Pull requests write. A pull request opened with the default `GITHUB_TOKEN` does not
fire `on: pull_request`, so the checks would not run at all and the update would have no
gate. Base images and action versions are Dependabot's, in `.github/dependabot.yml`;
nothing in the deps job touches a `FROM` line or a `uses:` pin.

Green there means the frameworks behave identically, not that they are still as fast.
`validate.yml` generates no load, so a framework update that costs performance shows up the
next night as a ring on the chart.

## Not built yet

Quarkus on either function host, the capability suites, and the fixed native calibrator
that checks the host has not drifted mid-run. Until the calibrator exists, nothing catches a
host that slowed down halfway through a run.
