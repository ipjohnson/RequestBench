# Frameworks

Each directory `frameworks/<language>/<name>/` holds an application written with one web framework.
The application serves every endpoint that the tests in `tests/` call. The orchestrator builds it
into a container image, runs the tests against it, and measures it. The framework's id is
`<language>:<name>`, such as `dotnet:carter`.

| Language | Frameworks |
| --- | --- |
| .NET | [ASP.NET Core minimal APIs](dotnet/minimal-apis), [ASP.NET Core MVC](dotnet/aspnet-mvc), [Carter](dotnet/carter), [FastEndpoints](dotnet/fastendpoints), [Wolverine.HTTP](dotnet/wolverine-http) |
| Go | [chi](go/chi), [Echo](go/echo), [Fiber](go/fiber), [Gin](go/gin), [gorilla/mux](go/gorilla-mux) |
| Java | [Helidon SE](java/helidon-se), [Javalin](java/javalin), [Micronaut](java/micronaut), [Quarkus](java/quarkus), [Spring Boot](java/spring-boot), [Vert.x Web](java/vertx) |
| Node | [Express](node/express), [Fastify](node/fastify), [h3](node/h3), [Hono](node/hono), [Koa](node/koa) |
| Python | [Django](python/django-asgi), [FastAPI](python/fastapi), [Flask](python/flask), [Litestar](python/litestar), [Sanic](python/sanic), [Starlette](python/starlette) |
| Rust | [actix-web](rust/actix-web), [axum](rust/axum), [poem](rust/poem), [Rocket](rust/rocket), [Salvo](rust/salvo), [warp](rust/warp) |

[Carter](dotnet/carter) is the worked example.

## The tests

Each test is a file, `tests/<family>/<name>.ts`. A family is a group of tests of one feature, such
as `json`, `cors` or `static`. A test's id is `<family>.<name>`, such as `json.small`.
[`openapi.json`](openapi.json) lists every endpoint the tests call, with its method, parameters and
responses. `npm run spec` generates it from the tests.

There are two kinds of test:

- A performance test is checked and then measured. A framework must pass every performance test,
  or it is not measured.
- A validation test is checked and not measured. A framework that cannot pass one lists it in
  rb.json `skips`, with the reason.

## Adding a framework

1. Create `frameworks/<language>/<name>/` with the files in [Layout](#layout).
2. Write the application and its `Dockerfile`. See [The application](#the-application) and
   [The container](#the-container).
3. Write `rb.json`. See [rb.json](#rbjson).
4. Write `client-exception/index.ts` and register it. See [client-exception](#client-exception).
5. Write the framework's own tests in `UnitTests/`, at least one for each performance test.
6. Mark the code the orchestrator cannot find by itself. See [Marks](#marks).
7. Add `Client/` if the framework can write an OpenAPI document about its own routes. See
   [Client](#client).
8. Write `README.md`. See [The framework's README](#the-frameworks-readme).
9. Add the framework to the table above.
10. Run the checks in [Before committing](#before-committing).

Run `git add` on new files as you go. The `npm run rb` commands read git's index, not the
directory, so they do not see untracked files. The image is built from tracked files too.

## Layout

| Path | What it is |
| --- | --- |
| `README.md` | Required. How the framework is built, run, tested and wired, and its Notes. |
| `rb.json` | Required. What the framework declares about itself. |
| `Dockerfile` | Builds the image. |
| `Implementation/` | The application. |
| `UnitTests/` | The framework's own tests. |
| `client-exception/index.ts` | How the tests read the framework's error responses. |
| `Client/` | Optional. The framework's OpenAPI document and a client generated from it. |

The language's build files, such as `solution.slnx`, `pom.xml`, `Cargo.toml`, `go.mod`,
`pyproject.toml` or `package.json`, sit at the top of the directory. Copy the arrangement from a
framework in the same language.

## The application

- Serve every endpoint in [`openapi.json`](openapi.json).
- Listen on `0.0.0.0` at the port `PORT` names.
- Load the payloads before listening, from the directory `RB_PAYLOADS` names. They are the committed
  files in `tests/payloads/`. Do not copy or generate them.
- Return the framework's own error responses. Never reshape an error to suit the tests.
  `client-exception` tells the tests how to read them.

The application also serves two routes that the tests do not call:

- `GET /health` returns 200 with a non-empty body once the framework is ready. The boot is timed
  to the first such response. A framework that gives none within 90 seconds fails to boot.
- `GET /__meta` returns a JSON object about the framework. The run summary reads `framework`,
  `version` and `runtime` from it. `version` is the version of the framework's package that was
  resolved. The framework's page shows `adapter` and `serializer` when they are present. The run
  file keeps the whole object.

## The container

The image is built from the framework's directory alone. A recorded run builds it from
`git archive` of that directory at the run's commit.

- Pin every `FROM` image by digest.
- Install dependencies from the lockfile inside the image, so the version `/__meta` reports is the
  version that runs. Carter restores with `--locked-mode`, and Fastify runs `npm ci`.

The orchestrator starts the container with these settings:

| Setting | Value |
| --- | --- |
| `PORT` | `8080` |
| `RB_HOST` | `container-h1`, the only host |
| `RB_PAYLOADS` | `/rb/payloads`, a read-only mount of `tests/payloads` |
| CPUs | A quota of 2, which `RB_CPUS` changes, or the cores `RB_SUT_CPUS` names |

A framework runs one process, except in Python. A Python framework runs two worker processes,
because one Python process runs Python code on one core at a time. Write the worker count as the
number 2. Under a CPU quota, Python counts the host's cores, not the container's.

The application must stop when it receives SIGTERM. It runs as PID 1, and the kernel gives PID 1
no default action for SIGTERM. Most runtimes and servers install a handler of their own. Node does
not, and neither do several Rust servers, so on those the application installs one. Without a
handler, `docker stop` waits out its timeout.

## rb.json

rb.json declares what the framework is and how to build, test and upgrade it.
[Carter's rb.json](dotnet/carter/rb.json) is a complete example.

| Field | Meaning |
| --- | --- |
| `comment` | Optional. Why anything in the file departs from the obvious. JSON has no comments. |
| `framework` | The framework's name, as its project writes it. |
| `licence` | The framework's licence, as an SPDX identifier. |
| `repo` | The framework's source repository. |
| `package` | The registry page of the package that was resolved. |
| `docs` | Optional. The framework's documentation. |
| `lockfile` | The tracked files that pin the resolved versions, or `null` if nothing is pinned. |
| `hosts` | For each host, the `dockerfile` and optional `buildArgs`. `container-h1` is the only host. |
| `suite` | How to run the framework's own tests. `argv` is the command, and `paths` are the directories that hold the tests. `cwd` and `env` are optional. |
| `upgrade` | A command that moves the pinned versions within their ranges, or `null` if they are moved by hand. |
| `client` | Optional. How `Client/` is written. See [Client](#client). |
| `skips` | Optional. Validation tests the framework does not pass, each with the reason. |
| `noHandler` | Optional. Performance tests the framework answers without a handler of its own, each with what answers it. The usual ones are a router's 404 and 405 and a CORS preflight. |
| `mechanisms` | One entry for each family. An entry either names what wires the family in `mechanism`, with optional `dependency` and `mentions`, or says in `builtin` why there is no wiring to show. See [Wiring](#wiring). |

Every path in rb.json must stay inside the framework's directory and be tracked.
`npm run rb -- check` enforces this. It also checks that `skips` names validation tests, that
`noHandler` names performance tests, and that `mechanisms` covers every family.

## client-exception

`client-exception/index.ts` tells the tests how to read the framework's error responses. It
default-exports `exceptions({...})` from `@rb/tests/kit`, with these fields:

| Field | Meaning |
| --- | --- |
| `about` | A description of the framework's error responses. |
| `rejected` | The status for a body that fails validation. |
| `malformed` | Optional. The status for a body that does not parse. It defaults to `rejected`. |
| `notFound` | The status for a path with no route. |
| `wrongMethod` | The status for a path requested with a method it has no route for. |
| `reports` | Optional. `"all"` if the error for a body with several bad fields names all of them, or `"first"` if it names only the first. It defaults to `"all"`. |
| `envelope` | A zod schema of the error body. |
| `fields` | A function that returns the fields an error body names, spelled as the tests spell them. |
| `message` | A function that returns the message for one field. |

[Carter's](dotnet/carter/client-exception/index.ts) is an example.

Register it in `frameworks/exceptions.ts`: import it, add the id to `FrameworkId`, and add the
entry. The root `npm run typecheck` reads `client-exception/` and no other file of the framework's.
A framework written in TypeScript checks its own source with its own `tsconfig.json`.

## Marks

The framework's page on the site shows three things for each test: the code that answers it, the
code that wires its family, and the framework's own test of it. The orchestrator finds most
handlers by itself. It finds everything else through marks, which are comments in the code.

A mark is a comment of the form `rb:<kind> <selector>[,<selector>...]`. It labels the block of code
under it. Put `rb:end` after the block when the block would otherwise end too soon. A selector is a
test id such as `json.small`, a family such as `json.*`, or `*` for the whole framework.

| Mark | Selector | What it marks |
| --- | --- | --- |
| `rb:handler` | A test | The code that answers the request. |
| `rb:wiring` | A family | The code that makes the family work, which the route does not name. |
| `rb:test` | One or more tests | A test in the framework's own suite. |

`npm run rb -- snippets <id>` shows what the orchestrator found for each test. `rb check` fails a
framework that breaks any rule in [`orchestrator/marks.ts`](../orchestrator/marks.ts).

### Handlers

With no mark, the orchestrator looks for a string literal that matches the test's path, such as
`"/json/small"`. A parameter matches in any of the usual forms, such as `:id`, `{id}` or `<id>`.
The orchestrator reads the HTTP method from the same line. It knows GET, POST, PUT, PATCH and
DELETE. Mark the handler with `rb:handler` when this search fails:

- The path literal and the method are on different lines, such as on two annotations.
- The route's method is HEAD or OPTIONS, so the route matches every method.
- The path is written relative to a parent route or scope.
- The code that answers is apart from the path literal, as when a handler is registered by name.
- The path matches in more than one place.

Keep a path literal on the line of the call that names its method. Do not let a formatter split
that call. Any other string that reads as a route also matches, such as the struct tag
`json:"items"` or a template named `items`. Rename it or mark the handler.

Every performance test needs a handler, except the tests rb.json lists in `noHandler`. A handler
cannot be only annotations, attributes and comments.

### Wiring

Every family that rb.json declares with `mechanism` needs at least one `rb:wiring` mark. The marked
code must contain the `mentions` token, or the `dependency` if there is no `mentions`. Carter's
`body` family names FluentValidation as its dependency and mentions `AbstractValidator`, which is
what its code contains. A family declared `builtin` needs no wiring mark.

### Tests

Every performance test needs an `rb:test` mark on at least one test in the framework's own suite.
The marked test must contain the test's id. A mark with a family or `*` as its selector marks a
shared helper, which does not meet this rule. Put the id where the language's test runner can
select it:

| Language | Where the id goes |
| --- | --- |
| .NET | `[Trait("corpus", "<id>")]` on the test |
| Java | `@Tag("<id>")` on the test |
| Node | The start of the test's name |
| Python | `@pytest.mark.corpus("<id>")` on the test |
| Go | A subtest, `t.Run("<id>", ...)` |
| Rust | The test's doc comment |

## Client

`Client/` holds the OpenAPI document the framework writes about its own routes, and a client
generated from that document. Add it only when the framework's own tooling can write the document
from the routes as they are. A framework has no `Client/` when it needs a third-party library to
write a document, documents only routes rewritten for its OpenAPI support, or reads a document
instead of writing one. Its README says which.

- The document comes from the framework's own tooling. The tooling may start the application to
  read it, where that is how the tooling normally runs.
- Do not change a route to improve the document. A Fastify body schema, for example, would make a
  route validate a body it should only parse. Options of the tool that writes the document are
  fine.
- The client comes from the generator the framework's documentation recommends. If it recommends
  none, use Kiota where Kiota supports the language well, even through a community plugin.
- The tools that write the document and the client run from the framework's directory with its own
  toolchain.
- Nothing in `Client/` goes into the image. Writing the document must not change what the image
  runs. Carter, for example, writes it only when `RB_PAYLOADS` is set, and the image build never
  sets it.
- Commit the document. Commit the client too, unless its generator rewrites it on every build.
- Test the client in the framework's own suite, with no `rb:test` mark, because the test checks the
  client and not the framework. A client in a different language from the suite is tested by the
  client command instead.

rb.json `client` has these fields:

| Field | Meaning |
| --- | --- |
| `document` | The OpenAPI document, under `Client/`. |
| `writer` | What writes the document. |
| `generator` | What generates the client, and at which version. |
| `argv` | The command that rewrites both. `cwd` and `env` are optional. |

`npm run rb -- client <id>` runs `argv` with `RB_PAYLOADS` set, and fails if anything under
`Client/` changed. It needs the framework's toolchain on PATH, as the suite does, and whatever the
generator needs. Kiota's Linux binary, for example, needs libicu.

## The framework's README

A framework's README says what the framework is, how to build, run and test it, and how each family
is wired. [Carter's README](dotnet/carter/README.md) is the model.

It must have a `## Notes` section. The Notes are a list of what the framework does that a reader
would not expect, such as closing a connection after a response, never sending a header, or
applying a setting to the whole application. The framework's page on the site ends with this list,
read from the README at the run's commit.

- `rb check` fails a README with no `## Notes`, with an empty one, or with a line under it that is
  not an item, an item's indented continuation, or blank.
- An item is plain text with inline code. Only a link to an absolute URL shows as a link on the
  site, such as a link to an issue in the framework's tracker.

## Commands

| Command | What it does |
| --- | --- |
| `npm run rb -- check` | Checks every framework's rb.json, files and marks. It should report 0 problems. |
| `npm run rb -- snippets <id>` | Shows where the framework answers each test. |
| `npm run rb -- suite <id>` | Runs the framework's own tests on this machine. The framework's toolchain must be on PATH. |
| `npm run rb -- validate <id> --exemplars` | Builds the image, runs every test against the container, and writes each test's request and response to `results/exemplars/<language>-<name>@container-h1.json`. |
| `npm run rb -- validate --at <host:port> --framework <id>` | Runs every test against a server you started yourself. |
| `npm run rb -- upgrade <id>` | Runs rb.json's `upgrade` and shows what moved. |
| `npm run rb -- client <id>` | Runs rb.json's `client` and fails if anything under `Client/` changed. |
| `npm run rb -- measure <id> --seconds 10` | Runs a short measurement that is never recorded. |

## Before committing

1. `git add` the directory.
2. `npm run typecheck` and `npm test` pass.
3. `npm run rb -- check` reports 0 problems.
4. `npm run rb -- suite <id>` passes.
5. `npm run rb -- validate <id> --exemplars` passes every performance test.
6. `npm run rb -- client <id>` reports `Client/` current, if rb.json declares `client`.
7. Commit the exemplar file with the framework.
