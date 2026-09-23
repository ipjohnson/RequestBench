# Litestar

Litestar 2.24.0 on CPython 3.14, served by uvicorn 0.53.0 with two worker processes, answering the
RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Litestar is a Python ASGI framework. A handler's parameters are its bindings: a path capture, a
query value, a header or a body is declared by its type, and Litestar converts it with msgspec
before the handler runs. A handler's return value is encoded by msgspec too, so the models here are
msgspec Structs.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `server.py` starts uvicorn, `main.py` is what each worker imports, `app.py` builds the application, and `routes/` holds one module per corpus family. |
| `UnitTests/` | pytest tests of the wiring, sending each request through Litestar's TestClient. |
| `Client/` | The OpenAPI document Litestar builds from the routes, and the TypeScript client Hey API generates from it, with its own `package.json`. |
| `client-exception/` | How the corpus reads Litestar's error bodies. |
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
`server.py` runs uvicorn's supervisor with `workers=2`: it binds the socket and starts two worker
processes, and each imports `main`, loads the payloads and accepts from that socket. The count is
written as 2 rather than read from the machine, because under a CPU quota Python counts every core
the host has.

uvicorn is the first server Litestar's deployment documentation lists, and the one its own
`litestar run` command starts. With more than one worker, `litestar run` starts uvicorn as a child
process of its own, so the image starts uvicorn itself, as PID 1.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's store are both
per worker, so two workers answering one path can carry different serials. A connection stays with
the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and `media_type=MediaType.TEXT` writes it. | Litestar |
| json | A returned Struct, which Litestar encodes with msgspec straight to JSON bytes. | Litestar, msgspec |
| middleware | No-op `ASGIMiddleware` layers in the route's `middleware`. | Litestar |
| parameters | Path captures typed `int` in the path and declared `FromPath`. | Litestar |
| query | Handler parameters declared `FromQuery`, or with `QueryParameter` where the key differs. | Litestar |
| headers | Handler parameters declared with `HeaderParameter`, the account as an `int`. | Litestar |
| body | The order as the `data` parameter, a Struct with types alone on the bind routes and orderRequest's rules as msgspec constraints on the validate routes. | Litestar, msgspec |
| authorized | A guard on the route that raises `PermissionDeniedException`. | Litestar |
| cache | Litestar's response cache, turned on per route with `cache=True` and expiring after `ttlSeconds` by the application's `ResponseCacheConfig`, over the default `MemoryStore`, with a key builder for the vary routes. | Litestar |
| compressed | `CompressionMiddleware` on the family's Router, at its default minimum size and gzip's fastest level. | Litestar |
| etag | An `ASGIMiddleware` on the family's Router that hashes the body with SHA-1 and answers 304 when `If-None-Match` names it. | by hand |
| template | A Jinja2 template rendered by `JinjaTemplateEngine` through the application's `TemplateConfig`. | Litestar, Jinja2 |
| items | One handler per method on `/items/{id:int}`, with GET and HEAD on the read route. | Litestar |
| errors | Litestar's router's 404 and 405, its 400 for a body that is not JSON, and the items handlers' `NotFoundException`. | Litestar |
| cors | `CORSConfig`, as the application's `cors_config`. | Litestar |
| forms | `URLEncodedBody` and `MultipartBody` data parameters, the upload an `UploadFile`. | Litestar |
| stream | Litestar's `Stream` typed `application/x-ndjson`, over an async generator of each row's bytes. | Litestar |
| sse | Litestar's `ServerSentEvent`, over an async generator of each row's JSON. | Litestar |
| static | Litestar's static files router over the payload directory, at `/static`. | Litestar |

## Notes

- Litestar takes CORS as the application's `cors_config` alone, and the CORS middleware left the
  public API in 2.9. So the policy covers every route, a preflight to any path is answered, and
  `cors.scoped` is skipped. The middleware wraps the whole application, so every request pays for
  its look at the `Origin` header.
- Litestar answers HEAD only where a route names it, so the read route names HEAD beside GET, and
  uvicorn leaves the body unwritten.
- msgspec stops at the first rule a body breaks, so `body.rejected_all` names one field and the
  first-error route needs nothing of its own.
- Litestar converts a body in msgspec's lax mode, so `"7"` binds to an `int` field.
- A POST handler answers 201 unless it names another status, so the body and forms routes name 200.
- Litestar computes no validator for an answer and never reads `If-None-Match`, so the etag family
  is wired by hand. The static files router writes an `ETag` on every file and answers the same
  file in full when `If-None-Match` names it.
- `Stream` and `ServerSentEvent` run each step of a plain iterator on a worker thread, so both
  routes hand them async generators. `ServerSentEvent` still runs its first step on a worker thread
  on every answer, to write an event id, type or retry that this route does not set.
- `ServerSentEvent` writes each item it is given as an event's data and encodes nothing, so the
  route encodes each row with msgspec itself. It adds `Cache-Control: no-cache`,
  `Connection: keep-alive` and `X-Accel-Buffering: no` to every answer.
- Litestar's `CompressionConfig` compresses at gzip level 9 by default, the slowest level. The
  family runs at level 1 instead, the fastest level every framework here compresses at.
- A 405's `Allow` header lists the methods in an order that changes from one process to the next.
- `UploadFile` keeps no size, so the multipart handler reads the file to learn it.
- uvicorn writes one access-log line per request by default. `server.py` turns that off, because
  no other framework in the corpus logs a request.

## Refusals

Every refusal is Litestar's own, written by its default exception handler as
`{"status_code": ..., "detail": ...}`. Nothing reshapes it.

- A body that breaks a rule is Litestar's `ValidationException`, 400, with `extra` holding one
  entry that names the field's path as `key`, such as `customerId` or `lines[0].qty`.
- A body that is not JSON is the same 400 with msgspec's message as `detail` and no `extra`.
- A path no route matches is the router's 404, and a method the path has no handler for its 405.
- A missing row is a `NotFoundException`, 404, with the same body as the router's. A wrong token,
  or none, is the guard's `PermissionDeniedException`, 403.

## Client

`Client/` holds the OpenAPI document Litestar builds from the handlers' signatures and a TypeScript
client generated from it. Litestar's path to a client is litestar-vite, from the Litestar
organization, which exports the application's document and runs Hey API over it. litestar-vite also
needs its Vite plugin in the application and a frontend project, so `Client/` takes the two steps it
runs, and `Client/` is a Node package of its own.

- `Client/document.py` builds the application with an `OpenAPIConfig` and writes
  `app.openapi_schema.to_schema()` to `Client/openapi.json`, as litestar-vite exports it. The config
  adds the documentation routes to that application and changes no other route. The image's
  application has no config and serves no documentation routes. Nothing listens.
- `@hey-api/openapi-ts` 0.98.2, the version litestar-vite 0.31.0 scaffolds, pinned exactly because
  it is below 1.0, writes the client to `Client/HeyApi/` with the plugins litestar-vite's templates
  configure, and with `.ts` imports, which Node's type stripping loads.
- `npm run client --prefix Client` installs the package, writes both, typechecks them and runs
  `Client/client.test.ts`, which starts the Implementation under uvicorn and calls it through the
  client. `npm run rb -- client python:litestar` runs it and fails if anything under `Client/`
  changed. It needs uv and Node.

What the document leaves out:

- The static files router's route, which Litestar does not document, and the preflight the CORS
  middleware answers.
- The 304 the etag family answers, which no handler declares.
- The type of the stream and sse answers. Litestar documents a `Stream` and a `ServerSentEvent` as
  `application/json` with an empty schema.

Every other route in the corpus has its body, parameters and answer typed. A handler that takes a
parameter or a body also declares the 400 Litestar's validation writes.
