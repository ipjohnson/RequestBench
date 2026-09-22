# Adding a framework

A framework is a directory, `frameworks/<language>/<name>/`, that answers every performance test in
`tests/` from a container and holds itself to that with its own suite. Its id is
`<language>:<name>`, taken from the path. Nothing registers it except its entry in
`frameworks/exceptions.ts`. [`dotnet/carter`](dotnet/carter) is the worked example, and
[`node/fastify`](node/fastify) is one in TypeScript.

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
| `Client/` | Only for a framework that emits a client of its own. |

The build files the language needs sit at the top of the directory, beside the solution. Carter
has `solution.slnx`, `global.json`, `nuget.config` and `Directory.Build.props` there.

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

## Marks

The site shows, for every test, the code that answers it, the code that wires its family, and the
suite's test of it. Most of that is found from the source. A route literal the test's path matches
is its handler. The method is read from the literal's own line, so keep the literal on the line of
the call that names the method, or it matches every method. Marks cover the rest. A mark is a comment,
`rb:<kind> <selector>[,<selector>...]`, and labels the block under it. `rb:end` closes one where
the block would stop short. A selector is `family.name`, `family.*` or `*`.

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
  `node --test --test-name-pattern=<id>` runs it.

Every performance test needs a marked test in the framework's suite, and `rb check` fails a
framework that lacks one. The same holds for every other assertion in `orchestrator/marks.ts`.
There is no allowance.

## Commands

| Command | What it does |
| --- | --- |
| `npm run rb -- check` | Every rb.json, bundle and mark, with 0 problems expected. |
| `npm run rb -- snippets <id>` | Where the framework answers each test. |
| `npm run rb -- suite <id>` | rb.json's suite. |
| `npm run rb -- validate <id> --exemplars` | Builds the image, runs the corpus against the container, and writes `results/exemplars/<language>-<name>@container-h1.json`. |
| `npm run rb -- validate --at <host:port> --framework <id>` | The corpus against a server started by hand. |
| `npm run rb -- upgrade <id>` | Runs rb.json's `upgrade` and shows what moved. |
| `npm run rb -- measure <id> --seconds 10` | A short smoke run. It is never recorded. |

Before committing a framework, work through this list:

1. `git add` the directory.
2. `npm run typecheck` and `npm test` pass.
3. `npm run rb -- check` reports 0 problems.
4. `npm run rb -- suite <id>` passes.
5. `npm run rb -- validate <id> --exemplars` passes every performance test.
6. Commit the exemplar with the framework.
