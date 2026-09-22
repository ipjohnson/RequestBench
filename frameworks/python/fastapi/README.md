# FastAPI

FastAPI 0.141.1 on CPython 3.14, served by uvicorn 0.53.0 with two worker processes, answering the
RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

FastAPI is a Python framework over Starlette. A handler's parameters are its bindings: a path
capture, a query string, a header or a body is declared by its type, and Pydantic validates and
converts it before the handler runs. A declared return type is serialized by Pydantic too.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `server.py` starts uvicorn, `main.py` is what each worker imports, `app.py` builds the application, and `routes/` holds one module per corpus family. |
| `UnitTests/` | pytest tests of the wiring, sending each request through Starlette's TestClient. |
| `client-exception/` | How the corpus reads FastAPI's error bodies. |
| `pyproject.toml` | The dependencies, the suite's dependencies, and pytest's settings. |
| `uv.lock` | What uv resolved, which the image installs. |

There is no client, because FastAPI emits none.

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

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's store are both
per worker, so two workers answering one path can carry different serials. A connection stays with
the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The handler returns the string, and `PlainTextResponse` writes it. | FastAPI |
| json | A declared return type. FastAPI serializes it with Pydantic straight to JSON bytes. | FastAPI, Pydantic |
| middleware | No-op dependencies on the route, each run rather than cached. | FastAPI |
| parameters, headers | `int` path parameters, and `Header()` parameters read by name. | FastAPI |
| query | A Pydantic model of the query string. | FastAPI, Pydantic |
| body | The order as a Pydantic body parameter, with types alone on the bind routes and orderRequest's rules on the validate routes. | FastAPI, Pydantic |
| authorized | `HTTPBearer` reads the token, and a dependency on the route compares it. | FastAPI |
| cache | A route class that answers from a `TTLCache` before the handler and stores what the handler answered. | by hand, cachetools |
| compressed | `GZipMiddleware` at its defaults, on a sub-application mounted at `/compressed`. | Starlette |
| etag | A route class that hashes the body with SHA-1 and answers 304 when `If-None-Match` names it. | by hand |
| template | A Jinja2 template rendered by `Jinja2Templates`. | FastAPI, Jinja2 |
| items | One path operation per method on `/items/{id}`, with GET and HEAD on the read route. | FastAPI |
| errors | Starlette's router's 404 and 405, FastAPI's 422 for a body that is not JSON, and the items handlers' `HTTPException`. | FastAPI, Starlette |
| cors | `CORSMiddleware` on a sub-application mounted at `/cors`. | Starlette |
| forms | A form model and an `UploadFile`, both parsed by python-multipart. | FastAPI |
| stream | The handler yields each row's bytes into a `StreamingResponse` typed `application/x-ndjson`. | FastAPI |
| sse | `EventSourceResponse`, which serializes each row the handler yields as one event. | FastAPI |
| static | `StaticFiles` over the payload directory, mounted at `/static`. | Starlette |

Choices a reader might not expect:

- FastAPI has no middleware on a route or a router. A mounted sub-application is how it scopes
  one, so compressed and cors are sub-applications with a middleware each, and every other route
  runs none.
- Starlette matches routes in the order they were added, so the baseline and json routes come
  first. The documentation routes are off, because they would come ahead of every other.
- FastAPI answers HEAD only where a route names it, so the read route names HEAD beside GET.
- FastAPI resolves a dependency once per request however often a route lists it. The middleware
  layers pass `use_cache=False`, so each one runs.
- FastAPI's own JSON Lines streaming answers `application/jsonl`, and `stream.ndjson` asks for
  `application/x-ndjson`. The route streams bytes through a response class of that type instead,
  as FastAPI documents for any other media type, and writes each row with Pydantic.
- Starlette's GZipMiddleware compresses at level 9 by default, the slowest level, and the family
  runs at that default.
- uvicorn writes one access-log line per request by default. `server.py` turns that off, because
  no other framework in the corpus logs a request.

## Refusals

Every refusal is FastAPI's or Starlette's own, written as `{"detail": ...}`. Nothing reshapes it.

- A body that breaks the rules is FastAPI's 422, with Pydantic's list of every failure under
  `detail`, each naming its field in `loc`.
- Pydantic cannot stop at the first failure, so `/body/validate/first-error` is wired by hand. A
  dependency checks the rules one field at a time, each as a model of that field alone, and raises
  FastAPI's `RequestValidationError` holding the first failure. The answer is the entry the full
  check would have listed first.
- A body that is not JSON is FastAPI's 422, with one `json_invalid` entry.
- A path no route matches is Starlette's 404, and a method the path has no route for its 405.
- A missing row is an `HTTPException` with 404, and a wrong token one with 403. A request with no
  bearer token at all is `HTTPBearer`'s own 401.
