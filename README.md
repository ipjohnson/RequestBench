# RequestBench

RequestBench measures HTTP frameworks in .NET, Go, Java, Node, Python and Rust. Every framework
answers the same tests from a container. The orchestrator checks each answer against what the test
expects, then measures latency at fixed request rates. Most tests are read against a simpler one,
so a result says what one feature costs, such as validating a body, compressing a response or
adding a middleware layer.

## How it works

1. Each test in [`tests/`](tests) sends one request and states the answer it must get. A family
   groups the tests of one feature, such as `json`, `cors` or `cache`.
2. Each framework in [`frameworks/`](frameworks) is an application that serves every endpoint the
   tests call, written the way that framework is normally used.
3. The orchestrator builds each framework into a container image and runs every test against it.
   A framework that fails a performance test is not measured.
4. The traffic generator sends the performance tests at fixed rates and records a latency
   histogram for each test.
5. The run file records the latencies, the machine, the commit and a hash of each framework's
   files. `npm run rb -- summarize` turns it into the summary the site reads.
6. The site in [`site/`](site) shows each test's latency, its cost against the test it is read
   against, and the code that answered it.

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
| [`traffic-generator/`](traffic-generator) | The load generator a measurement runs. |
| [`site/`](site) | The results explorer, an Astro site. See [site/README.md](site/README.md). |
| [`results/exemplars/`](results/exemplars) | Each framework's request and response for every test, which the site shows. |

A measurement writes its run file to `results/runs/`, and summaries go to `results/summary/`.
Neither is committed.

## Requirements

- Node.js 22.6 or later. The scripts run the TypeScript sources with Node's type stripping, so
  nothing is compiled.
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

`npm test` checks every test against a reference server, and the orchestrator against its own
tests. It needs no framework and no Docker. `validate` builds a framework's image and runs every
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
performance tests at the rates set in [`orchestrator/ladder.ts`](orchestrator/ladder.ts):

| Phase | Requests per second | Length |
| --- | --- | --- |
| warmup | 1,000 | 30 seconds, not recorded |
| regular | 500 | A 15-second settle, then 60 seconds |
| raised | 2,500 | A 15-second settle, then 60 seconds |
| peak | 5,000 | A 15-second settle, then 60 seconds |

If a rate's settle drops more than 5% of its requests, the framework's measurement ends there.

The traffic generator picks a test at random for each request. It is open loop: each request has a
scheduled moment, and its latency counts from that moment. A backlog in the framework or the
generator therefore shows up as latency. Requests are built before timing starts, and the
generator reads each response with its own minimal HTTP/1.1 client.

The only host is `container-h1`: the framework's image in a container, reached over HTTP/1.1. Each
framework's container gets 2 CPUs. These variables change where things run:

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
