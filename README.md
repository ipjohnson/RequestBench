# RequestBench

RequestBench measures HTTP frameworks in .NET, Go, Java, Node, Python and Rust. Every framework
answers the same tests from a container. The orchestrator checks each answer against what the test
expects, then measures latency at fixed request rates. Most tests are read against a simpler one,
so a result says what one feature costs, such as validating a body, compressing a response or
adding a middleware layer.

Results: https://ipjohnson.github.io/RequestBench/

## How it works

1. Each test in [`tests/`](tests) sends one request and states the answer it must get. A family
   groups the tests of one feature, such as `json`, `cors` or `cache`.
2. Each framework in [`frameworks/`](frameworks) is an application that serves every endpoint the
   tests call, written the way that framework is normally used.
3. The orchestrator builds each framework into a container image and runs every test against it.
   A framework that fails a performance test is not measured.
4. The traffic generator sends the performance tests at fixed rates and records a latency
   histogram for each test, and one for each 10 seconds of its recording.
5. The run file records the latencies, the machine, the commit and a hash of each framework's
   files. `npm run rb -- summarize` turns it into the summary the site reads.
6. The site in [`site/`](site) shows each test's latency and how it moved through the recording,
   its cost against the test it is read against, and the code that answered it. A blend is a set
   of tests read together off their merged histograms: every test, the Web or API tests, or a set
   the reader picks. The tests pages show each family, and each test's request and the checks its
   answer has to pass.

## Principles

- A framework uses its own facilities where it has them. It validates with its own validation
  layer, renders with its own view engine and returns its own error responses.
- A correct answer is written down. Each test compares the response with data the corpus knows
  exactly, and frameworks are never compared with each other.
- A value a handler echoes is drawn once per run and never given to a framework, so no framework
  can answer from a table.
- An error body is the framework's own. Each framework declares in `client-exception` how the tests
  read its errors.
- A test is read against a base test that differs from it in one factor, so the difference
  measures that factor alone.
- Every number traces to code. A run records a hash of each framework's files, and the site shows
  the code that answered each test at the run's commit.

## Repository layout

| Path | What it is |
| --- | --- |
| [`tests/`](tests) | The corpus: every test, the data frameworks serve, and the kit tests are written with. See [tests/README.md](tests/README.md). |
| [`frameworks/`](frameworks) | One directory per framework, and [`openapi.json`](frameworks/openapi.json), which documents every endpoint. See [frameworks/README.md](frameworks/README.md). |
| [`orchestrator/`](orchestrator) | The `rb` command: checks, validation, measurement and summaries. |
| [`traffic-generator/`](traffic-generator) | The load generator a measurement runs: a Rust program that speaks each host's protocol and does all of the timing, and the TypeScript that runs the corpus through it. |
| [`site/`](site) | The results explorer, an Astro site. See [site/README.md](site/README.md). |

A measurement writes its run file to `results/runs/`, and each framework's exemplars, its request
and response for every test, to `results/exemplars/`. Summaries go to `results/summary/`. None of
them is committed.

## Requirements

- Node.js 22.6 or later. The scripts run the TypeScript sources with Node's type stripping, so
  nothing of theirs is compiled.
- Rust through rustup, for the traffic generator. cargo builds it the first time a command needs
  it, with the toolchain `traffic-generator/rust-toolchain.toml` pins.
- Docker, to build and run the framework containers.
- A framework's own toolchain, such as the .NET SDK, a JDK with Maven, Go, Rust, or Python with
  uv, to run its tests with `npm run rb -- suite` or rewrite its client with
  `npm run rb -- client`.
- Linux, for a run that is recorded.

## Getting started

```sh
npm ci
npm run typecheck
npm test
npm run rb -- check
npm run rb -- validate node:fastify
npm run rb -- measure node:fastify --seconds 10
```

`npm test` checks every test against a reference server, and the orchestrator and the traffic
generator against their own tests. It needs no framework and no Docker. `validate` builds a framework's image and runs every
test against the container. `measure --seconds 10` is a short smoke run, which is never recorded.

To look at a local run in the site:

```sh
npm run rb -- summarize results/runs/<run>.json --out results/summary/<run>.json
npm run site -- --summaries results/summary --unrecorded
```

The site is written to `site/dist`. [site/README.md](site/README.md) covers the other ways to build
and view it.

## Measuring

`npm run rb -- measure` measures every framework, or the ones named, one at a time. It builds each
image and boots it once to run every test. It then boots it again, times the boot, and offers the
performance tests at the rates of one ladder in [`orchestrator/ladder.ts`](orchestrator/ladder.ts).
`--ladder` names it, and the `ci` ladder below is used when it is not given:

| Phase | Requests per second | Length |
| --- | --- | --- |
| warmup | 1,000 | 30 seconds, not recorded |
| regular | 1,000 | A 15-second settle, then 60 seconds |
| raised | 2,500 | A 15-second settle, then 60 seconds |
| peak | 5,000 | A 15-second settle, then 60 seconds |

If a rate's settle drops more than 5% of its requests, the framework's measurement ends there.

The traffic generator picks a test at random for each request. It is open loop: each request has a
scheduled moment, and its latency counts from that moment. A backlog in the framework or the
generator therefore shows up as latency. Requests are built before timing starts. The timing, the
HTTP/1.1 client that reads each response, and the gate's own requests are the Rust program in
`traffic-generator/src/`, so the gate checks the bytes the load sends.

A host is where a framework is started and how it is reached, and each host is its own run.
`container-h1` is the framework's image in a container, reached over HTTP/1.1, with 256
connections that each carry one request at a time. `container-h2` reaches the framework's image
over HTTP/2 with prior knowledge and no TLS, with 16 connections that each carry 16 streams.
`lambda-emulator` runs the framework as a Lambda function on its language's AWS base image, on one
core. The Rust program serves the Lambda Runtime API in Lambda's place, and the function's own
runtime client asks it for each event, an API Gateway payload format 2.0 request. Its load is a
closed loop: each event goes out the moment the runtime asks, for 120 recorded seconds on `ci` that
start with the first event the function answers. Nothing warms it, because a Lambda function's
first event is live traffic. The requests that learn each answer are sent to the gate's function
instead. Each test records the invoke phase, from the event's write to the runtime's next request
for one, and the Telemetry API's three spans within it. The run also keeps the first invocation
and each second's mean invoke phase on their own, so the cold start shows apart from the tail. Each
framework's container on the other hosts gets 2 CPUs. These variables change where things run:

| Variable | Effect |
| --- | --- |
| `RB_CPUS` | The container's CPU quota, 2 by default. |
| `RB_SUT_CPUS` | The cores the framework runs on, in place of a quota. |
| `RB_GEN_CPUS` | The cores the traffic generator runs on. |

Every run records the machine: its CPU, whether SMT and boost are on, the clock governor, and which
cores are isolated. Nothing requires a particular state yet.

A run is recorded only when it was made on Linux, from a clean working tree, at a pushed commit,
over the whole corpus at full length. The site shows only recorded runs unless it is built with
`--unrecorded`.

[`measure.yml`](.github/workflows/measure.yml) measures every framework each night on the `ci`
ladder, one GitHub-hosted runner for each host a framework implements, with the framework on cores
0 and 1 and the generator on cores 2 and 3. It adds each run's summary to the `results` branch,
under `runs/`, and the exemplars its gates captured under `exemplars/`.
[`pages.yml`](.github/workflows/pages.yml) then publishes the site from them.

## Commands

`npm run rb` with no command prints this list with every option.

| Command | What it does |
| --- | --- |
| `list` | Lists every framework and the hosts it implements. |
| `check` | Checks every rb.json, every framework's files, and where each framework answers each test. |
| `bundle` | Prints the files, roles and hashes a run records for a framework or for the tests. |
| `snippets` | Shows where each framework answers each test. |
| `siteview` | Prints what the site shows about the code and the tests behind a run. |
| `validate` | Runs every test against a framework, in its container or started by hand. |
| `measure` | Measures frameworks on one host and writes `results/runs/<run>.json`. |
| `summarize` | Turns a run file into the summary the site reads. |
| `suite` | Runs each framework's own tests, as its rb.json declares. |
| `client` | Rewrites each framework's OpenAPI document and client, and fails if `Client/` changed. |
| `upgrade` | Moves each framework's pinned versions, as its rb.json declares. |

`npm run spec` regenerates `frameworks/openapi.json` from the tests, and `npm run site` builds the
site.

## Contributing

To add a framework, follow [frameworks/README.md](frameworks/README.md). To add a test or a family,
follow [tests/README.md](tests/README.md).
