# RequestBench

A cross-language HTTP framework benchmark. Thirty-one frameworks across six languages,
measured on one machine held still, so what gets published is the time each one took at a
traffic level you can hold against your own.

The endpoint set is designed in [docs/blend-v2.html](docs/blend-v2.html),
[docs/measurement-v2.html](docs/measurement-v2.html) is how measurement works, and
[docs/bundles.html](docs/bundles.html) covers tracing a published number back to the code
that produced it.

## Two rules the whole thing rests on

**Real times, and the machine is part of the result.** Nothing is divided by anything. A
run records the CPU, the core count, the container's CPU budget, the fixed clock and the
isolation, because a millisecond only means something alongside the machine that produced
it. `harness/machine.py` checks that machine before a run and can refuse one that would
describe its own configuration rather than a framework.

**Behaviour is shared, wiring is not.** Within a language, every target imports the same
domain module and differs only in how routes are bound to it. If two targets disagree about
what an endpoint returns, that is a bug in one of them, not a performance result — which is
why `conform.py` fingerprints every response and refuses to measure a target that drifts.

## Layout

    spec/endpoints.json   45 endpoints in 13 families, drawn uniformly
    spec/blends.json      weight vectors, applied when an aggregate is composed
    spec/ladder.json      five rungs, 500 -> 12000 rps, 60s each
    spec/matrix.json      languages, frameworks, the anchor each is gated against
    spec/fixture.json     generated, committed: identical data for all 43 targets
    spec/plan.json        generated: pre-resolved concrete requests every driver replays
    spec/sequence.json    generated: the fixed replay order every serial host uses
    harness/              plan, conformance gate, orchestrator, bundles, aggregator
    gen/blend.mjs         open-loop blend driver
    targets/<lang>/       one directory per target, plus _shared/ domain logic

## Comparing across languages

Milliseconds are the shared denominator, so Go against Node is an ordinary comparison
rather than an impossible one. It holds inside a run: one job boots every implemented
target back to back on one machine, and nothing about that machine changes between them.

    python3 harness/hosts.py --host container    # what that job would run
    python3 harness/run.py --mode docker --languages go,node

A hosted job is capped at six hours, which at roughly 370s per target holds about 58
targets. The full 43-target plan fits; adding the capability suites would not. Java is in
the run, and Java warms for 90s rather than 30s, so every target in a run now warms for
90s: the warmup has to be the same for all of them or the comparison inside the run is
not one.

## Running it

    make plan
    make run                                               # everything, both rates, 4 min each
    make run LANGUAGES=node SECONDS=12 RUNGS=regular       # host processes, quick loop
    make build TARGETS=go:gin,go:echo,go:chi               # container images
    make run LANGUAGES=go MODE=docker
    make machine                                           # is this box fit to measure on
    make report
    make vars                                              # every variable and its default

Everything is on by default. `make run` with no variables measures every implemented
target the host supports, at both rates, for the durations in `spec/ladder.json`. The
variables narrow it: `LANGUAGES` and `FRAMEWORKS` choose what runs, `FAMILIES` and
`ENDPOINTS` choose what it is asked for, and each has a `NOT_` form that excludes instead.
`RPS`, `SECONDS` and `WARMUP` override the spec for a quick loop.

    make run FRAMEWORKS=gin,fastify                        # two frameworks, two languages
    make run NOT_LANGUAGES=java                            # everything but the JVM
    make run FAMILIES=json,compressed                      # only those endpoints are live

Narrowing the endpoint set is not the blend with rows hidden. A runtime optimises for the
paths it executes, so nine endpoints running alone are hotter than the same nine inside the
full forty-five, and the numbers are not comparable to a full run. Such a run records
itself as its own profile and the summary carries it, so nothing reads the two together.

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
rate-dependent floor of roughly 150us at the lowest rate. It is the same constant for
every target at that rate, so it subtracts out of a comparison between two of them, but it
sits inside every published time and has to be measured against a null target and taken
off rather than left to cancel.

## Status

Working: the spec and plan, the conformance gate with cross-target response comparison,
the open-loop generator with per-endpoint histograms, the orchestrator in both host and
container mode, the aggregator, the machine preflight, the nightly measurement split by
execution host, the nightly framework update, target bundles with a framework page per
target, and sixteen targets across three languages. Node has Fastify, Express, Hono, Koa and h3. Go has Gin,
Echo, chi, gorilla/mux and Fiber. Java has Spring Boot, Quarkus, Micronaut, Helidon SE,
Vert.x and Javalin.

Each language names an anchor in `spec/matrix.json` — Fastify, Gin, Spring Boot. That
target boots first and its responses become the fingerprint every other target in the
language is compared against. Fastify and Gin answer the forty-five endpoints of
`blend-v2`; the other fourteen still answer `blend-v1`, so the conformance gate reports
them as pending rewiring and the orchestrator measures nothing for them.

Every run records the commit it measured and a content hash of each target's bundle: its
own wiring, the shared domain module, the dependency manifests and the Dockerfiles. The
site rebuilds that manifest out of history at the recorded commit, checks it against the
recorded hash, and renders a page per target carrying its README, where each endpoint is
wired, and a link to those exact lines on GitHub at the commit that ran. Where the hash
does not verify the code is shown without a link, because the one failure worth preventing
is a real number over the wrong lines. `docs/bundles.html` is the design; framework
metadata, logos and the comparison pages in it are not built yet, and sixteen targets have
no README.

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
Micronaut is on all three
through its own AWS and GCP adapters, and Spring Boot is on Lambda through
aws-serverless-java-container. Javalin, Vert.x and Helidon SE have no first-party adapter
for either function host, and a hand-written shim would measure the shim. Quarkus has one
for both and is not wired to either yet.

Not built yet: the other three languages, Quarkus on either function host, the ten
capability suites, and the machine calibrator.

The current numbers are **not admissible** under the plan's own rules: the generator runs on
the same machine as the target, there is no calibrator, and no host is pinned. They prove
the pipeline, not the frameworks.
