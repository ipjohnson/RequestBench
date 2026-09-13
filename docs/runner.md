# Running measurements out of band

Validation runs on every pull request. Measurement never does: a shared CI runner cannot
produce a timing worth keeping, and two measurements must never overlap on one machine.

## What the schedule does

`.github/workflows/measure.yml` fires seven crons, one per night at 02:00 UTC, and asks
`harness/rotation.py` what tonight is. Day of week picks the shard, ISO week parity picks
the suite, and both live in `spec/matrix.json`.

    python3 harness/rotation.py --calendar     # the next fortnight
    python3 harness/rotation.py --shard go     # what a go night would run

Every run joins the `requestbench-measure` concurrency group with `cancel-in-progress:
false`, so a second run queues behind the first rather than sharing the machine with it.

## The runner

The workflow targets a runner labelled `requestbench`. Until one is registered, scheduled
runs queue and expire, which is harmless but means nothing is being collected.

To register one on the measurement host:

    # Settings > Actions > Runners > New self-hosted runner, then on that machine:
    ./config.sh --url https://github.com/ipjohnson/RequestBench \
                --token <token> --labels requestbench --unattended
    sudo ./svc.sh install && sudo ./svc.sh start

The host needs Docker, Python 3.13, and enough cores to keep the load generator off the
target's cores. Set the repository variable `RB_CPUS` to the CPU budget each target
container gets; it defaults to 2.

## What a run leaves behind

Raw samples, one histogram per endpoint per rung, are gzipped into a build artifact with
90-day retention. A summary of a few kilobytes is committed to `results/summary/`, holding
ratios rather than absolutes; that is the durable series regression detection reads.

Runs on any runner other than `requestbench` are recorded with `tracked: false` so a
smoke test cannot contaminate the series.

## Running one by hand

    gh workflow run measure.yml \
      -f runner=requestbench -f shard=go -f seconds=15 -f rungs=1,3,5

Leave `shard` at `auto` to follow the rotation. Use a non-`requestbench` runner label only
for proving the pipeline works.

## Not built yet

The capability suites, the anchor sweep's multi-shard run, and the fixed native calibrator
that checks the host has not drifted mid-run. The workflow skips those nights rather than
recording something it cannot stand behind.
