# Starlette

Starlette 1.7.0 on CPython 3.14, served by uvicorn 0.53.0 with two worker processes, answering the
RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Starlette is a small ASGI framework. An endpoint takes the `Request` and returns a `Response`, and a
`Route` or a `Mount` can wrap it in middleware of its own. Starlette binds and validates nothing
beyond a path capture's convertor. SpecTree, the request validation Starlette's third-party packages
page lists, binds the query strings, headers, forms and bodies here, with Pydantic models.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `main.py` is what each worker imports, `app.py` builds the application, `validation.py` holds the SpecTree instance, and `routes/` holds one module per corpus family. |
| `container-h1/` | How container-h1 starts it. `server.py` starts uvicorn with two workers, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `server.py` is the handler's module, which puts the application behind Mangum for awslambdaric, the runtime client, and `Dockerfile` builds the function on the `python:3.14` base image, with the packages and the application together in the task root. |
| `UnitTests/` | pytest tests of the wiring, sending each request through Starlette's TestClient, and of the Kiota client. |
| `Client/` | The OpenAPI document Starlette's SchemaGenerator builds from the endpoints' docstrings, and the Python client Kiota generates from it. |
| `client-exception/` | How the corpus reads SpecTree's error bodies. |
| `pyproject.toml` | The dependencies, the suite's dependencies, lambda-emulator's adapter as a group of its own, and pytest's settings. |
| `uv.lock` | What uv resolved, which each host's image installs. |

## Building, running and testing

```sh
uv sync
cd Implementation && RB_PAYLOADS=../../../../tests/payloads PORT=8080 ../.venv/bin/python ../container-h1/server.py
uv run pytest
```

The suite and `rb upgrade` run through [uv](https://docs.astral.sh/uv/), which has to be installed.

`RB_PAYLOADS` names the payload directory, which each worker loads before it accepts a connection.
`PORT` defaults to 8080.

## Two workers

The container gets two cores, and one Python process runs Python on one core at a time. So
`server.py` runs uvicorn's supervisor with `workers=2`: it binds the socket and starts two worker
processes, and each imports `main`, loads the payloads and accepts from that socket. The count is
written as 2 rather than read from the machine, because under a CPU quota Python counts every core
the host has.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's store are both
per worker, so two workers answering one path can carry different serials. A connection stays with
the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The endpoint returns a `PlainTextResponse`. | Starlette |
| json | `JSONResponse`, which serializes the payload dict with the standard library's `json`. | Starlette |
| middleware | No-op pure ASGI middleware on the `Route`, which wraps that route's endpoint alone. | Starlette |
| parameters | `{one:int}` path captures, which Starlette's convertor matches and converts. | Starlette |
| query | A Pydantic model of the query string, bound by SpecTree. | SpecTree, Pydantic |
| headers | A Pydantic model of the three headers, bound by SpecTree. `/headers` reads none. | SpecTree, Pydantic |
| body | The order as a Pydantic model bound by SpecTree, with types alone on the bind routes and orderRequest's rules on the validate routes. | SpecTree, Pydantic |
| authorized | `AuthenticationMiddleware` on the route with a bearer backend, and `requires` on the endpoint. | Starlette |
| cache | A decorator that answers from a `TTLCache` before the endpoint and stores what the endpoint answered. | by hand, cachetools |
| compressed | `GZipMiddleware` on each of the family's routes, at its default threshold and gzip's fastest level. | Starlette |
| etag | A decorator that hashes the body with SHA-1 and answers 304 when `If-None-Match` names it. | by hand |
| template | A Jinja2 template rendered by `Jinja2Templates`. | Starlette, Jinja2 |
| items | An `HTTPEndpoint` on `/items/{id:int}`, one function per method, with HEAD answered by `get`. | Starlette, SpecTree |
| errors | Starlette's router's 404, `HTTPEndpoint`'s 405, SpecTree's 422 for a body that is not JSON, and the items endpoint's `HTTPException`. | Starlette, SpecTree |
| cors | `CORSMiddleware` on a `Mount` at `/cors`. | Starlette |
| forms | A form model bound by SpecTree, and the upload read with `request.form()`, both parsed by python-multipart. | SpecTree, Starlette |
| stream | The endpoint yields each row's JSON line into a `StreamingResponse` typed `application/x-ndjson`. | Starlette |
| sse | `EventSourceResponse`, which writes each row the endpoint yields as one event. | sse-starlette |
| static | `StaticFiles` over the payload directory, mounted at `/static`. | Starlette |

## Notes

- SpecTree validates a JSON body only when its content type is exactly `application/json`. With a
  parameter, such as `application/json; charset=utf-8`, it validates nothing and hands the endpoint
  no model, so the endpoint fails and Starlette answers 500.
- SpecTree answers a refusal with Pydantic's failures, each with its `input`. A missing header's
  input is the whole of Starlette's `Headers`, which `json` cannot serialize, so a request without
  one of the three bound headers is a 500 rather than a 422.
- A `Route`'s own middleware runs only after the route has matched the method. A CORS preflight is
  an OPTIONS request to a GET route, which the router refuses with 405 first, so the cors family
  is a `Mount`, whose middleware runs before its routes are matched.
- A function route's 405 lists its methods from a set, so their order in `Allow` changes between
  processes.
- `HTTPEndpoint` answers HEAD with its `get`, and its 405 lists the methods it has functions for,
  so HEAD is missing from that `Allow` header.
- Starlette's GZipMiddleware compresses at level 9 by default, the slowest level. The family runs
  at level 1 instead, the fastest level every framework here compresses at.
- sse-starlette sends `Connection: keep-alive`, `Cache-Control: no-store` and
  `X-Accel-Buffering: no` with every stream, and ends each line with CRLF.
- uvicorn writes one access-log line per request by default. `server.py` turns that off, because
  no other framework in the corpus logs a request.
- On lambda-emulator the application answers behind Mangum 0.22, which reads API Gateway payload
  format 2.0. Mangum buffers the whole answer into one proxy response, so the sse and stream tests
  are listed as unsupported there.
- Mangum runs the ASGI lifespan's startup and shutdown around every event rather than once, so
  `lambda-emulator/server.py` turns the lifespan off. The application registers nothing for either.
- Mangum posts whatever the application writes for HEAD, where uvicorn leaves the body unwritten. A
  Function URL's caller reads no body in an answer to HEAD, so nothing reads it.
- Mangum writes `Content-Type: application/json` on an answer that has none, such as the 204 of
  `items.delete`.
- Mangum runs every event on asyncio's own event loop, so uvloop, which uvicorn picks on
  container-h1, goes unused on lambda-emulator.
- The function on lambda-emulator is one process, which answers one event at a time, so `/__meta`
  reports one worker there.
- On lambda-emulator the runtime client puts its log handler on the root logger, so the line
  SpecTree logs at error level for each 422 it answers is written to the function's output. Under
  uvicorn no handler takes it.

## Refusals

Every refusal is Starlette's or SpecTree's own. Nothing reshapes it.

- A body that breaks the rules is SpecTree's 422, with Pydantic's list of every failure as the
  whole body, each naming its field in `loc`.
- Pydantic cannot stop at the first failure, so `/body/validate/first-error` binds a model whose
  wrap validator checks the rules one field at a time, each as a model of that field alone, and
  raises the first failure as its own `ValidationError`. SpecTree answers it with the entry the full
  check would have listed first.
- A body that is not JSON is SpecTree's 422, as `{"error_msg": ...}` with the parser's message.
- A path no route matches is Starlette's 404, as text.
- A missing row is an `HTTPException` with 404, and a method `/items/{id}` has no function for is
  `HTTPEndpoint`'s 405, both as text.
- A token that is not settings.json's leaves the request unauthenticated, and `requires` answers
  403 as text. A request with no token is refused the same way.

## Client

`Client/` holds the OpenAPI document Starlette's own `SchemaGenerator` builds from the routes, and a
Python client Kiota generates from it. Starlette's documentation recommends no client generator, so
the client is Kiota's.

- `SchemaGenerator` walks the routes, Mounts included, and reads each endpoint's docstring as YAML:
  the operation for that path and method, with its parameters, body and answers. An endpoint with
  no YAML docstring is left out, so every endpoint here has one. The docstrings change no answer.
- `Client/document.py` builds the application and writes `get_schema()` to `Client/openapi.json`,
  with the components the docstrings refer to declared in the base schema it starts from. Nothing
  listens.
- `Client/generate.py` runs `document.py`, then Kiota 1.35.0. No Kiota runs from PyPI, so it
  downloads the release for the platform from Kiota's GitHub releases, checks it against the
  SHA-256 Microsoft's `@microsoft/kiota` 1.35.0 package carries for it, and keeps it under
  `Client/bin/`, which git ignores. It uses the standard library alone. Kiota's Linux build needs
  libicu.
- Kiota writes the client to `Client/Kiota/`. Kiota renames the `json` path segment `json_escaped`
  as a package, and the client still calls it `client.json`.
- `uv run --locked python Client/generate.py` writes both. `npm run rb -- client python:starlette`
  runs it and fails if anything under `Client/` changed. `UnitTests/test_client.py` calls the
  application in process through the client, over httpx's ASGI transport, and runs in the suite.

What the document leaves out:

- `HEAD /items/{id}`, because `SchemaGenerator` skips HEAD, and `OPTIONS /cors/small`, which the
  CORS middleware answers with no endpoint.
- `/static`, a Mount of `StaticFiles`, which has no routes to read.

Kiota makes no error type for an answer that is text or an array, so a 403, a 404 or a 422 reaches
the caller as Kiota's `APIError` with its status.
