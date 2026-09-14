# RequestBench

A cross-language HTTP framework benchmark. Thirty-seven frameworks across six languages,
each measured against a bare baseline in its own runtime, so what gets published is the
overhead a framework adds rather than an absolute number that only describes the machine
it ran on.

The full design and the capability suites are in [docs/plan.md](docs/plan.md).

## Two rules the whole thing rests on

**Nothing absolute is ever published.** Every run carries a bare baseline for each language
in it, written in that language (`net/http`, bare Netty, `node:http`, raw ASGI, raw Kestrel,
`hyper`), booted alongside the frameworks. Results are ratios to it. That divides out machine
speed and how the runtime behaved on that machine that night, and what remains is framework
overhead.

**Behaviour is shared, wiring is not.** Within a language, every target imports the same
domain module and differs only in how routes are bound to it. If two targets disagree about
what an endpoint returns, that is a bug in one of them, not a performance result — which is
why `conform.py` fingerprints every response and refuses to measure a target that drifts.

## Layout

    spec/endpoints.json   40 endpoints, families, integer weight shares out of 10000
    spec/ladder.json      five rungs, 500 -> 12000 rps, 60s each
    spec/matrix.json      languages, frameworks, baselines, warmup class
    spec/fixture.json     generated, committed: identical data for all 43 targets
    spec/plan.json        generated: pre-resolved concrete requests every driver replays
    harness/              plan, conformance gate, orchestrator, aggregator
    gen/blend.mjs         open-loop blend driver
    targets/<lang>/       one directory per target, plus _shared/ domain logic

## Comparing across languages

Within a language, a framework is reported as a ratio to that language's bare baseline,
which divides out the machine. Across languages there is no shared denominator, so two
ratios measured on different machines cannot be put side by side.

Runs are split by execution host, never by language, which is what makes the comparison
possible. One job is one host and boots every implemented target in every language back to
back, so nothing about the machine changes between targets and the absolute numbers from
that single run are comparable across languages.

    python3 harness/hosts.py --host container    # what that job would run
    python3 harness/run.py --mode docker \
      --targets go:net-http,go:gin,node:node-http,node:fastify

A hosted job is capped at six hours, which at roughly 370s per target holds about 58
targets. The full 43-target plan fits; adding the capability suites would not.

## Running it

    make plan
    make run SECONDS=12 RUNGS=1,3,5                        # node, host processes, quick loop
    make build TARGETS=go:net-http,go:gin,go:echo          # container images
    make run TARGETS=go:net-http,go:gin,go:echo MODE=docker
    make run                                               # full ladder, 5 x 60s
    make report

`MODE=local` runs targets as host processes, which is the fast edit loop. `MODE=docker`
builds an image per target and runs it with a pinned CPU budget (`RB_CPUS`, default 2),
which is what measurement uses. Go, Java and Rust only have a container path, since the
image carries the toolchain.

## Why the generator is written rather than bought

`ab` and plain `wrk` are closed-loop and suffer coordinated omission, so their tail numbers
become fiction the moment a target starts queueing. `gen/blend.mjs` is open loop: each
request has a scheduled moment, and latency is measured from that moment rather than from
when the socket was actually written. A backlog therefore shows up as latency instead of
quietly disappearing.

Two things about it are worth knowing. It schedules with `setImmediate` rather than
`setTimeout`, because `setTimeout`'s ~1ms floor lands directly in the range being measured;
that change moved the unloaded p50 floor from ~800us to ~200us. And it still has a
rate-dependent floor of roughly 150us at the lowest rung, which is identical for every
target at that rung and therefore cancels in the ratio.

## Status

Working: the spec and plan, the conformance gate with cross-target response fingerprinting,
the open-loop generator with per-endpoint histograms, the orchestrator in both host and
container mode, the ratio aggregator, the nightly measurement split by execution host, and
twelve targets across two languages. Node has `node-http`, Fastify, Express, Hono, Koa and
h3. Go has `net-http`, Gin, Echo, chi, gorilla/mux and Fiber.

All twelve fingerprint-match each other on all 40 endpoints, across two languages.

Three execution hosts are implemented: the container contract, the GCP Functions Framework,
and the Lambda runtime interface emulator. Two targets do not cover all three. Fiber runs
only as a container, because it is fasthttp rather than an `http.Handler`. Koa has no Lambda
entry, because its body parser does not see a request body through serverless-express.

Not built yet: the other four languages, the ten capability suites, and the machine
calibrator.

The current numbers are **not admissible** under the plan's own rules: the generator runs on
the same machine as the target, there is no calibrator, and no host is pinned. They prove
the pipeline, not the frameworks.
