# Adding a framework

A framework is a directory, `frameworks/<language>/<name>/`, that answers every performance test in
`tests/` from a container and holds itself to that with its own suite. Its id is
`<language>:<name>`, taken from the path. Nothing registers it except its entry in
`frameworks/exceptions.ts`. [`dotnet/carter`](dotnet/carter) is the worked example. There is one in
each other language: [`node/fastify`](node/fastify), [`python/fastapi`](python/fastapi),
[`java/spring-boot`](java/spring-boot), [`rust/axum`](rust/axum) and [`go/gin`](go/gin).

Discovery, bundles and marks read git's index, not the directory. Run `git add` on new files before
any `npm run rb` command, or they do not exist to it.

## Layout

| Path | What it is |
| --- | --- |
| `README.md` | Required. What the framework is, how to build, run and test it, how each family is wired, and anything a reader would not expect. Carter's README is the model. |
| `rb.json` | Required. What the framework declares about itself, described below. |
| `Dockerfile` | How the image is built. |
| `Implementation/` | The application. |
| `UnitTests/` | The framework's own suite. |
| `client-exception/index.ts` | How the corpus reads the framework's error bodies. |
| `Client/` | The OpenAPI document the framework writes about its own routes, and the client generated from it. See Client below. |

The build files the language needs sit at the top of the directory, beside the solution. Carter
has `solution.slnx`, `global.json`, `nuget.config` and `Directory.Build.props` there. Spring Boot
has an aggregator `pom.xml` over two Maven modules, Implementation and UnitTests. axum has one
package's `Cargo.toml`, which names each target's path under Implementation/ and UnitTests/, and
its `Cargo.lock`. Gin has `go.mod` and `go.sum`.

## What the corpus asks

The tests are `tests/<family>/<name>.ts`. [`openapi.json`](openapi.json) lists every endpoint with its
method, parameters and answers. `npm run spec` generates it from the corpus. Every performance
test has to pass. A validation test the framework cannot satisfy is listed in rb.json `skips`
with the reason.

The payloads are the committed files in `tests/payloads/`. Load them at startup, before listening,
from the directory `RB_PAYLOADS` names. Do not copy or generate them.

A refusal is whatever the framework writes. Never reshape an error for the corpus.
`client-exception` declares how to read the framework's own.

## The container

The image is built from the framework's directory alone. A recorded run builds from `git archive`
of that directory at the commit, and a local run builds from its tracked files, so untracked files
never reach the image.

- Pin every `FROM` image by digest.
- Install from the lockfile inside the image. Carter restores with `--locked-mode` and Fastify runs
  `npm ci`, so the version `/__meta` reports describes what runs.

The orchestrator starts the container with these settings:

| Setting | Value |
| --- | --- |
| `PORT` | `8080`. Listen on `0.0.0.0` at this port. |
| `RB_HOST` | `container-h1`, the only host. |
| `RB_PAYLOADS` | `/rb/payloads`, a read-only mount of `tests/payloads`. |
| CPUs | 2 by quota, or the cores `RB_SUT_CPUS` names. |

A Node framework runs one process. A Python framework runs two workers, because one Python process
runs Python on one core at a time. [`python/fastapi`](python/fastapi) starts uvicorn with
`workers=2`, written as a number, because under a quota Python counts every core the host has.
A Java, Rust or Go framework runs one process. The JVM, tokio and Go's scheduler each size their
threads from the container's CPU quota, and each counts 2.

The framework is PID 1 in its container, and the kernel gives PID 1 no default action for SIGTERM.
The JVM, .NET, uvicorn and the Go runtime install a handler of their own. Node and a Rust binary
do not, so Fastify and axum stop on SIGTERM themselves. Without that, `docker stop` waits out its
timeout.

Two routes sit outside the corpus:

- `GET /health` answers 200 with a non-empty body once the framework is ready. The boot is timed
  to the first such answer, and a framework gets 90 seconds.
- `GET /__meta` answers JSON:
  - The run summary reads `framework`, `version` and `runtime`. `version` is the resolved package
    version.
  - The framework's page shows `adapter` and `serializer` where they are given.
  - Carter also answers `bootMs`.
  - The run file keeps the whole answer.

## rb.json

| Field | Meaning |
| --- | --- |
| `comment` | Why anything below departs from the obvious. JSON has no comments. |
| `framework` | The framework's name as its project writes it. |
| `licence` | An SPDX identifier. |
| `repo` | The framework's source repository. |
| `package` | The registry page of the package that was resolved. |
| `docs` | Optional. The framework's documentation. |
| `lockfile` | The tracked files that pin what was resolved, or `null` when nothing is pinned. |
| `hosts` | Per host, the `dockerfile` and optional `buildArgs`. Only `container-h1` exists. |
| `suite` | `argv` runs the framework's own tests. `paths` are the directories holding them, which the bundle counts as tests. `cwd` and `env` are optional. |
| `upgrade` | A command that moves the pins within their ranges, or `null` when they move by hand. |
| `client` | Optional. `document` is the OpenAPI document under `Client/`, `writer` says what writes it, `generator` says what generates the client and at which version, and `argv` rewrites both. `cwd` and `env` are optional. |
| `skips` | Validation tests the framework does not satisfy, each with the reason. |
| `noHandler` | Performance tests the framework answers with no handler of its own, each with what answers it. A router's 404 and 405 and a CORS preflight usually are. |
| `mechanisms` | One entry for every family. `{ "mechanism", "dependency", "mentions" }` names what wires it, or `{ "builtin" }` says why there is nothing to show. |

Every path stays inside the framework's directory and is tracked. `npm run rb -- check` holds each
rb.json to that and to the corpus. It also checks that `skips` names validation tests, `noHandler`
names performance tests and `mechanisms` covers every family.

## client-exception

`client-exception/index.ts` default-exports `exceptions({...})` from `@rb/tests/kit`. It declares
the following:

- `about`
- the statuses `rejected`, `malformed` (which defaults to `rejected`), `notFound` and `wrongMethod`
- `envelope`, a zod schema of the error body
- `fields`, the fields a body names, in the corpus's spelling
- `message`, the message for one field

Register it in `frameworks/exceptions.ts`. Import it, add the id to `FrameworkId`, and add the
entry. This is the only TypeScript of a framework's that the root typecheck reads. A framework
written in TypeScript compiles its own source with its own settings.

## Client

`Client/` holds the OpenAPI document a framework writes about its own routes and a client generated
from that document. Carter, Fastify, FastAPI and Spring Boot have one. axum and Gin do not, because
neither writes a document without a third-party library.

- The document comes from the framework's own tooling, reading the routes as the corpus has them.
  The ASP.NET Core frameworks use ASP.NET Core's generation. A Java framework may start its server
  to read the document, where that is how its tooling runs in CI.
- The client comes from the generator the framework's documentation recommends. Where it recommends
  none, the client is Kiota's, when Kiota supports the language well, even through a community
  plugin. FastAPI's is Hey API's, a TypeScript client, and the other three are Kiota's.
- Everything that writes the two runs from the framework's directory with its own toolchain, and
  rb.json `client.argv` runs it. `npm run rb -- client <id>` runs that with `RB_PAYLOADS` set and
  fails if anything under `Client/` changed.
- Both are committed. The bundle gives `Client/` the role `client`: it counts in `bundleHash` and
  not in `codeHash`, and the handler finder does not read it, because every route is in the
  document a second time.
- Nothing in `Client/` reaches the image, and writing the document must not change what the image
  runs. Carter writes it only when `RB_PAYLOADS` is set, and Spring Boot adds springdoc only under a
  Maven profile.
- The client's own tests go in the suite, without `rb:test` marks, because they hold the client and
  not a corpus row. FastAPI's TypeScript client is tested in `Client/` instead, by the client
  command.
- The client command needs the framework's toolchain on PATH, as the suite does, and whatever the
  generator needs beside it. FastAPI's needs uv and Node, Spring Boot's needs a JDK and Maven, and
  Kiota's Linux binary needs libicu, which a GitHub runner has.
- Change no route to improve the document. A Fastify body schema would validate a body the bind
  rows only parse. Options of the tool that writes the document are fine, such as Spring Boot's
  `application/json` default for answers the controllers do not type.

## Marks

The site shows, for every test, the code that answers it, the code that wires its family, and the
suite's test of it. Most of that is found from the source. A route literal the test's path matches
is its handler. The method is read from the literal's own line, so keep the literal on the line of
the call that names the method, or it matches every method. A formatter that breaks a call across
lines separates the two, which is why axum's registrations are not run through rustfmt. Any other
string that reads as a route matches too, with or without its leading slash, such as Gin's
`json:"items"` struct tag, a Thymeleaf view named `items` or a `"/items/{}"` format string. Rename
it or mark the route.

Marks cover the rest. A mark is a comment, `rb:<kind> <selector>[,<selector>...]`, and labels the
block under it. `rb:end` closes one where the block would stop short. A selector is `family.name`,
`family.*` or `*`.

`rb:handler`, with a test as the selector, marks the lines that answer the request.
- Use it where the route literal cannot be found or matches in more than one place.
- Every performance test needs a handler, except those in `noHandler`.

`rb:wiring`, with a family as the selector (`family.*`), marks the code that makes a family work
and that the route does not name.
- Every family rb.json declares with `mechanism` needs at least one.
- The marked code has to contain the `dependency`, or the `mentions` token where the code spells it
  differently. Carter's body family says `AbstractValidator` for FluentValidation.
- A family declared `builtin` has none.

`rb:test`, with tests as the selectors, marks a test in the framework's own suite that holds it to
those tests.
- The marked code has to contain each test's id.
- Carter puts `[Trait("corpus", "<id>")]` on the test, which also lets
  `dotnet test --filter corpus=<id>` run it. Fastify starts each test's name with its id, so
  `node --test --test-name-pattern=<id>` runs it. FastAPI puts `@pytest.mark.corpus("<id>")` on
  the test.
- Spring Boot puts `@Tag("<id>")` on the test, so `mvn test -Dgroups=<id>` runs it. Gin runs each
  id as a subtest, `t.Run("<id>", ...)`, so `go test ./UnitTests -run '/<id>'` runs it. axum names
  the ids in the test's doc comment, which the marked block runs through onto the function.

Every performance test needs a marked test in the framework's suite, and `rb check` fails a
framework that lacks one. The same holds for every other assertion in `orchestrator/marks.ts`.
There is no allowance.

## Commands

| Command | What it does |
| --- | --- |
| `npm run rb -- check` | Every rb.json, bundle and mark, with 0 problems expected. |
| `npm run rb -- snippets <id>` | Where the framework answers each test. |
| `npm run rb -- suite <id>` | rb.json's suite, run on this machine, so the framework's toolchain has to be on PATH. |
| `npm run rb -- validate <id> --exemplars` | Builds the image, runs the corpus against the container, and writes `results/exemplars/<language>-<name>@container-h1.json`. |
| `npm run rb -- validate --at <host:port> --framework <id>` | The corpus against a server started by hand. |
| `npm run rb -- upgrade <id>` | Runs rb.json's `upgrade` and shows what moved. |
| `npm run rb -- client <id>` | Runs rb.json's `client` and fails if it changed anything under `Client/`. |
| `npm run rb -- measure <id> --seconds 10` | A short smoke run. It is never recorded. |

Before committing a framework, work through this list:

1. `git add` the directory.
2. `npm run typecheck` and `npm test` pass.
3. `npm run rb -- check` reports 0 problems.
4. `npm run rb -- suite <id>` passes.
5. `npm run rb -- validate <id> --exemplars` passes every performance test.
6. `npm run rb -- client <id>` reports `Client/` current, when rb.json declares `client`.
7. Commit the exemplar with the framework.
