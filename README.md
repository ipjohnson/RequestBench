# RequestBench

A cross-language HTTP framework benchmark. Thirty-six frameworks across six languages,
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
what an endpoint returns, that is a bug in one of them, not a performance result.

**What a correct answer is, is written down.** `spec/expected.json` holds the status, the
content type, the content encoding and the body for every one of the 3,346 distinct requests
in the plan. `tests/` boots each target and checks all of them against it; nothing is ever
compared against another target, because agreement between two frameworks is evidence that
they are consistent and not that either is right. Every implemented target has to pass, with
no exemption list.

## Layout

    spec/endpoints.json   45 endpoints in 13 families, drawn uniformly
    spec/blends.json      weight vectors, applied when an aggregate is composed
    spec/ladder.json      five rungs, 500 -> 12000 rps, 60s each
    spec/matrix.json      languages, frameworks, the runtime each is pinned to
    spec/expected.json    generated, committed: what a correct answer is, per request
    spec/fixture.json     generated, committed: identical data for all 53 targets
    spec/plan.json        generated: pre-resolved concrete requests every driver replays
    spec/sequence.json    generated: the fixed replay order every serial host uses
    harness/              plan, expectation, conformance gate, orchestrator, bundles
    tests/                one test per target per endpoint, a file per family
    gen/blend.mjs         open-loop blend driver
    targets/<lang>/       one directory per target, plus _shared/ domain logic

## Comparing across languages

Milliseconds are the shared denominator, so Go against Node is an ordinary comparison
rather than an impossible one. It holds inside a run: one job boots every implemented
target back to back on one machine, and nothing about that machine changes between them.

    python3 harness/hosts.py --host container    # what that job would run
    python3 harness/run.py --mode docker --languages go,node

A hosted job is capped at six hours, which at roughly 370s per target holds about 58
targets. The full 53-target plan fits; adding the capability suites would not. Java is in
the run, and Java warms for 90s rather than 30s, so every target in a run now warms for
90s: the warmup has to be the same for all of them or the comparison inside the run is
not one.

## Running it

    make plan
    make test                                              # every target answers every endpoint
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
runs a jar the reactor has already built, Python needs `make python`, which builds the
virtualenv it launches them in, and .NET needs `make dotnet`, which publishes the dll the
container runs. Rust only has a container path, since the image carries the toolchain.

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
target, and thirty-three targets across six languages, all of them conforming. Node has
Fastify, Express, Hono, Koa and h3. Go has Gin, Echo, chi, gorilla/mux and Fiber. Java has Spring Boot, Quarkus,
Micronaut, Helidon SE, Vert.x and Javalin. Rust has axum, actix-web, Rocket, Poem, Salvo
and warp, Python has FastAPI, Starlette, Litestar, Sanic, Flask and Django over ASGI, and
.NET has minimal APIs, MVC controllers, FastEndpoints, Carter and Wolverine.HTTP.

All thirty-three answer the forty-five endpoints of `blend-v2`, and all thirty-three are
checked against `spec/expected.json` rather than against each other. The expectation is
derived from `node:fastify`, `go:gin`, `rust:axum` and `python:fastapi` — four languages on
four HTTP stacks — and only values all four produce are written; a disagreement is reported
and resolved against `spec/endpoints.json` by hand. One field is deliberately left unpinned,
listed in the file: whether a framework compresses a 125-byte body, which is what
`compressed.gzip_small` is in the set to show.

An error body is the framework's own. A 2xx body is the controlled variable and is pinned
exactly, but an envelope is a framework's contract — ProblemDetails, a FluentValidation
list, a bare object — and forcing thirty-three of them into one shape hides a real
difference and charges every target a handler to hide it. What an endpoint answering 400 or
above still owes is the status, a non-empty JSON body, and, for the two rejected rows, the
field errors the shared validator produced, found wherever the framework put them.
`spec/expected.json` records each target's envelope as a shape — every key path and the type
at it, values dropped — so a change to one is caught without any of them being made to
share. `errors.malformed` accepts 400 or 422, because 400 is the RFC status for syntax that
would not parse and 422 is what the validator's contract answers with.

The Rust targets share one Cargo workspace and one lockfile, so a difference between two
of them is the framework rather than a transitive dependency one happened to resolve
differently. `targets/rust/_shared` is a port of `targets/go/_shared/domain.go`, and every
response it produces was compared against the Node capture before the targets were
listed.

The .NET targets take the shared domain through the service collection:
`services.AddRequestBenchDomain()` reads the fixture once and registers one `DomainModel`
that every target injects. The domain itself depends on nothing but
`Microsoft.Extensions.DependencyInjection.Abstractions` — it is behaviour, not a web
application, and a reference to ASP.NET there would let one leak in. ServiceStack is not in
the .NET list: its free tier stops at ten operations against an endpoint set of forty-five,
and `spec/matrix.json` records why.

Python is the first language here where the framework is not the server. Five of the six
ship none, so each target runs the one its own documentation reaches for first — uvicorn
for FastAPI, Starlette and Litestar, daphne for Django, gunicorn for Flask — and Sanic runs
its own. Part of every delta between two Python targets is therefore the server, which is
why `/__meta` records it and its version beside the framework's. Every target is one
process, like the Node targets, so a Python target uses one of the two pinned cores while
Go, Rust and Java use both, and the published time says so. The six share one
`requirements.txt`, resolved from the ranges in `requirements.in`, for the same reason the
Rust targets share one lockfile.

Every run records the commit it measured and a content hash of each target's bundle: its
own wiring, the shared domain module, the dependency manifests and the Dockerfiles. The
site rebuilds that manifest out of history at the recorded commit, checks it against the
recorded hash, and renders a page per target carrying its README, where each endpoint is
wired, and a link to those exact lines on GitHub at the commit that ran. Where the hash
does not verify the code is shown without a link, because the one failure worth preventing
is a real number over the wrong lines. `docs/bundles.html` is the design; framework
metadata, logos and the comparison pages in it are not built yet, and twenty-four targets
have no README.

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

Not built yet: the .NET hardened target, .NET, Python and Rust on either function host,
Quarkus on either function host, the ten capability suites, and the machine calibrator.

The current numbers are **not admissible** under the plan's own rules: the generator runs on
the same machine as the target, there is no calibrator, and no host is pinned. They prove
the pipeline, not the frameworks.
