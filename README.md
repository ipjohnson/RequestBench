# RequestBench

A cross-language HTTP framework benchmark. Thirty-seven frameworks across six languages,
each measured against a bare baseline in its own runtime, so what gets published is the
overhead a framework adds rather than an absolute number that only describes the machine
it ran on.

The full design and the capability suites are in [docs/plan.md](docs/plan.md). The
endpoint set is designed in [docs/blend-v2.html](docs/blend-v2.html), and
[docs/bundles.html](docs/bundles.html) covers tracing a published ratio back to the code
that produced it.

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

    spec/endpoints.json   45 endpoints in 13 families, drawn uniformly
    spec/blends.json      weight vectors, applied when an aggregate is composed
    spec/ladder.json      five rungs, 500 -> 12000 rps, 60s each
    spec/matrix.json      languages, frameworks, baselines, warmup class
    spec/fixture.json     generated, committed: identical data for all 43 targets
    spec/plan.json        generated: pre-resolved concrete requests every driver replays
    spec/sequence.json    generated: the fixed replay order every serial host uses
    harness/              plan, conformance gate, orchestrator, bundles, aggregator
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
targets. The full 43-target plan fits; adding the capability suites would not. Java is in
the run, and Java warms for 90s rather than 30s, so every target in a run now warms for
90s: the warmup has to be the same for all of them or the comparison inside the run is
not one.

## Running it

    make plan
    make run SECONDS=12 RUNGS=1,3,5                        # node, host processes, quick loop
    make build TARGETS=go:net-http,go:gin,go:echo          # container images
    make run TARGETS=go:net-http,go:gin,go:echo MODE=docker
    make run                                               # full ladder, 5 x 60s
    make report

`MODE=local` runs targets as host processes, which is the fast edit loop. `MODE=docker`
builds an image per target and runs it with a pinned CPU budget (`RB_CPUS`, default 2),
which is what measurement uses. Java needs `make java` first, because the local launcher
runs a jar the reactor has already built. Rust only has a container path, since the image
carries the toolchain.

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
container mode, the ratio aggregator, the nightly measurement split by execution host, the
nightly framework update, and nineteen targets across three languages. Node has
`node-http`, Fastify, Express, Hono, Koa and h3. Go has `net-http`, Gin, Echo, chi,
gorilla/mux and Fiber. Java has bare Netty, Spring Boot, Quarkus, Micronaut, Helidon SE,
Vert.x and Javalin.

`node-http` implements the forty-five endpoints of `blend-v2` and is the contract each
framework then has to meet with its own facilities. The other eighteen still answer
`blend-v1`, which they fingerprint-match each other on, so the conformance gate fails
against them until they are rewired.

Framework versions are not held by hand. `.github/workflows/deps.yml` resolves the latest
release for each language nightly, patch and minor only, and opens one pull request per
manifest; `validate.yml` is the gate on it. That needs a `DEPS_TOKEN` secret, because a
pull request opened with the default token fires no checks.

Three execution hosts are implemented: the container contract, the GCP Functions Framework,
and the Lambda runtime interface emulator. Every Node and Go target covers all three except
Fiber, which runs only as a container because it is fasthttp rather than an `http.Handler`,
and Koa, which has no Lambda entry because its body parser does not see a request body
through serverless-express.

On Java the function hosts are thinner, and `spec/matrix.json` says why for each target.
Bare Netty is on all three, with a hand-written entry per host so the baseline is the floor
for its host rather than a translation of another host's floor. Micronaut is on all three
through its own AWS and GCP adapters, and Spring Boot is on Lambda through
aws-serverless-java-container. Javalin, Vert.x and Helidon SE have no first-party adapter
for either function host, and a hand-written shim would measure the shim. Quarkus has one
for both and is not wired to either yet.

Not built yet: the other three languages, Quarkus on either function host, the ten
capability suites, and the machine calibrator.

The current numbers are **not admissible** under the plan's own rules: the generator runs on
the same machine as the target, there is no calibrator, and no host is pinned. They prove
the pipeline, not the frameworks.
