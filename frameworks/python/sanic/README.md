# Sanic

Sanic 25.12.1 on CPython 3.14, served by Sanic's own server with two worker processes, answering
the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Sanic is an asynchronous Python framework that ships its own HTTP server, on uvloop. A handler takes
the request and returns a response, and a path capture reaches it as an argument, converted to the
type the route declares. Sanic Extensions (sanic-ext), from the same project, adds validation, CORS,
the automatic HEAD and OPTIONS routes, templating and the OpenAPI document.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `server.py` starts Sanic's manager, `main.py` holds the factory each worker builds the application with, `app.py` builds it, `routes/` holds one module per corpus family, and `documented.py` holds what the OpenAPI document says beyond what sanic-ext reads from a route. |
| `UnitTests/` | pytest tests of the wiring, sending each request to Sanic's own server through sanic-testing's ReusableClient, and tests of the Kiota client against `server.py`. |
| `Client/` | The OpenAPI document sanic-ext builds from the routes, the Python client Kiota generates from it, and the two scripts that write them. |
| `client-exception/` | How the corpus reads Sanic's error bodies. |
| `pyproject.toml` | The dependencies, the suite's dependencies, and pytest's settings. |
| `uv.lock` | What uv resolved, which the image installs. |

## Building, running and testing

```sh
uv sync
cd Implementation && RB_PAYLOADS=../../../../tests/payloads PORT=8080 ../.venv/bin/python server.py
uv run pytest
```

The suite and `rb upgrade` run through [uv](https://docs.astral.sh/uv/), which has to be installed.

`RB_PAYLOADS` names the payload directory, which each worker loads before it accepts a connection.
`PORT` defaults to 8080.

## Two workers

The container gets two cores, and one Python process runs Python on one core at a time. So
`server.py` runs Sanic's manager with `workers=2`: it binds the socket and starts two worker
processes. Sanic starts each worker as a new process, and hands it an `AppLoader` whose factory,
`main.create`, builds the application from the payloads before the worker accepts. The count is
written as 2 rather than read from the machine, because under a CPU quota Python counts every core
the host has, and so does Sanic's fast mode.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's store are both
per worker, so two workers answering one path can carry different serials. A connection stays with
the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns `text()`. | Sanic |
| json | The handler returns `json()`, which writes with ujson, a dependency of Sanic's own. | Sanic |
| middleware | No-op request middleware on the route's blueprint, four or sixteen of them. | Sanic |
| parameters | `<one:int>` captures, converted by Sanic's router. | Sanic |
| headers | The handler reads the three headers by name and converts the account with `int()`. | by hand |
| query | `@validate(query=...)` with a Pydantic model of the query string. | sanic-ext, Pydantic |
| body | `@validate(json=...)` with a Pydantic model, types alone on the bind routes and orderRequest's rules on the validate routes. | sanic-ext, Pydantic |
| authorized | A decorator in the pattern of Sanic's authentication guide, which compares `request.token` and raises `Forbidden`. | Sanic, by hand |
| cache | Request middleware on the blueprint answers from a `TTLCache` in the handler's place, and response middleware stores what the handler answered. | by hand, cachetools |
| compressed | Response middleware on the blueprint gzips at level 1 a body of 500 bytes or more. | by hand |
| etag | Response middleware on the blueprint hashes the body with SHA-1 and answers 304 when `If-None-Match` names it. | by hand |
| template | A Jinja2 template rendered by sanic-ext's `render()`. | sanic-ext, Jinja2 |
| items | One route per method on `/items/<id:int>`. sanic-ext adds the HEAD route, which runs the read handler. | Sanic, sanic-ext |
| errors | Sanic's router's 404 and 405, Sanic's `BadRequest` for a body that is not JSON, and the items handlers' `NotFound`. | Sanic |
| cors | sanic-ext's CORS, with the `@cors` policy on the one route. | sanic-ext |
| forms | Sanic parses both bodies, and `@validate(form=...)` binds the urlencoded one to the query's model. | Sanic, sanic-ext |
| stream | `request.respond()` typed `application/x-ndjson`, and each row sent as a line. | Sanic |
| sse | `request.respond()` typed `text/event-stream`, and each row sent as the data of one event. | Sanic |
| static | `app.static` over the payload directory. | Sanic |

## Notes

- Sanic answers 405 with no `Allow` header on a path with a capture, such as `POST /items/17`, and
  RFC 9110 requires one. On a static path, such as `POST /json/small`, the header is there. For a
  dynamic route sanic-routing re-raises its no-method error without the route's methods.
- The `Allow` header lists a route's methods in the order of a set, which changes between
  processes.
- Sanic picks a refusal's format per route by reading the handler's source. A route whose handler
  returns `json()` has its errors answered as JSON. A path with no route, and a 405, are answered as
  `text/plain`, whose first line starts with a warning sign.
- sanic-ext's CORS writes its headers from a response hook on every route of the application. The
  `@cors` policy on `/cors/small` decides which answers carry them, and the application's own
  policy names no origin, so every other route runs the hook and leaves the answer alone.
- sanic-ext adds an OPTIONS route beside every route, which answers 204 with `Allow`, and a HEAD
  route beside every GET route. Both are routes of the application rather than of the blueprint,
  so a blueprint's middleware does not run for them: `HEAD /cache/small` is never replayed and
  `HEAD /middleware/sixteen` runs no layer.
- sanic-ext's validation guide leads with dataclasses, which state a field's type and no rule, such
  as a minimum. sanic-ext validates a Pydantic model too, and Pydantic states orderRequest's rules.
- A refusal names its failures only as text. sanic-ext puts Pydantic's printed account of the
  failures into `message`, which `client-exception` reads line by line.
- Sanic and sanic-ext compress nothing, compute no ETag for a body a handler writes, and ship no
  response cache. Those three families are wired by hand, in their blueprint's middleware.
- sanic-ext serves an OpenAPI document and two pages about it under `/docs` by default. They are
  off, because the corpus asks for none of them, and `Client/document.py` turns them back on.
- Sanic writes one access-log line per request when its access log is on. `server.py` turns it
  off, and its banner, because no other framework in the corpus logs a request.
- Sanic shows its own modules' deprecation warnings once by default. On CPython 3.14 each of its
  processes prints two or three as it starts, because Sanic's event-loop setup calls asyncio
  functions that Python 3.16 removes.
- sanic-ext reads a route's path, method and captures, and nothing about what the handler reads or
  answers, so the document knows only what decorators and docstrings state. Its `@openapi.body`
  wraps the handler in a coroutine that calls it, so the request bodies are stated in YAML in each
  handler's docstring, which sanic-ext also reads, rather than with that decorator.
- sanic-ext labels its document OpenAPI 3.0.3 and fills it with Pydantic's JSON Schema, the 2020-12
  dialect of OpenAPI 3.1. A rule such as `gt=0` becomes `"exclusiveMinimum": 0`, which 3.0 reads
  as a boolean, so Kiota refuses the document as it is served. `Client/document.py` labels it 3.1.0.

## Refusals

Every refusal is Sanic's own, written by its error handler as
`{"description": ..., "status": ..., "message": ...}` for a route that answers JSON. Nothing
reshapes it.

- A body that breaks the rules is sanic-ext's `ValidationError`, which Sanic answers with 400. Its
  `message` is `Invalid request body: CheckedOrder. Error: ` and then Pydantic's account of every
  failure, each naming its field's dotted path on a line of its own.
- Pydantic cannot stop at the first failure, so `/body/validate/first-error` is wired by hand. It
  checks the rules one field at a time, each as a model of that field alone named `CheckedOrder`,
  through sanic-ext's own `validate_body`, and raises the first failure alone. Its message states
  that failure in the words the full check uses for it.
- A body that is not JSON is Sanic's `BadRequest`, 400, with the message
  `Failed when parsing body as json` and no field.
- A path no route matches is Sanic's 404, and a method the path has no route for its 405, both as
  text.
- A missing row is Sanic's `NotFound`, 404, and any token but the accepted one its `Forbidden`,
  403.

## Client

`Client/` holds the OpenAPI document sanic-ext builds from the routes and a Python client Kiota
generates from it. Sanic's documentation recommends no client generator, so the client is Kiota's.

- `Client/document.py` builds the application, turns sanic-ext's OpenAPI extension back on, and
  starts the application in process through sanic-testing's ASGI client, which binds no socket. It
  writes the document the extension serves at `/docs/openapi.json` to `Client/openapi.json`, with
  its keys sorted, because Sanic's router hands the routes to sanic-ext in an order that follows
  Python's hash seed.
- sanic-ext documents a route's path, method and captures. What each route answers and which query
  parameters and headers it reads come from sanic-ext's `@openapi.response` and
  `@openapi.parameter`, through the helpers in `Implementation/documented.py`, and each request
  body from YAML in the handler's docstring. The answers are typed by Pydantic models written for
  the document, because the handlers answer with dictionaries.
- `Client/generate.py` runs `document.py`, then Kiota 1.35.0. No Kiota is published to PyPI, so it
  downloads the release zip for the machine from Kiota's GitHub releases, checks the SHA-256 that
  Microsoft's `@microsoft/kiota` 1.35.0 package carries for it, and keeps it under `Client/bin/`,
  which git ignores. Kiota writes the client to `Client/Kiota/`. On Linux, Kiota needs libicu.
- `npm run rb -- client python:sanic` runs it with uv and fails if anything under `Client/`
  changed. The client's tests are in `UnitTests/test_client.py`, which starts `server.py` and
  calls it through the client with the runtime in `microsoft-kiota-bundle`.

What the document leaves out:

- `/static/<file>`, which sanic-ext does not document, and the automatic HEAD and OPTIONS routes,
  which it leaves out by default.
- The 304 the etag family answers, which no route declares.
