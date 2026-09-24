# Django

Django 6.1.1 over ASGI on CPython 3.14, served by uvicorn 0.53.0 with two worker processes,
answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Django is a Python framework whose router, forms, middleware, cache and template language are all
its own. Its views here are async, so under ASGI Django runs them on the event loop rather than in a
thread. A view receives the request and returns a response. Django parses no JSON body and binds no
header, so the views do both, and a `django.forms.Form` binds and validates everything else.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `asgi.py` is what each worker imports, `settings.py` configures Django and loads the payloads, `urls.py` routes every path, and `views/` holds one module per corpus family. |
| `container-h1/` | How container-h1 starts it. `server.py` starts uvicorn with two workers, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `server.py` is the handler's module, which puts Django's ASGI application behind Mangum for awslambdaric, the runtime client, and `Dockerfile` builds the function on the `python:3.14` base image, with the packages and the application together in the task root. |
| `UnitTests/` | pytest tests of the wiring, sending each request through Django's AsyncClient. |
| `client-exception/` | How the corpus reads Django's error bodies. |
| `pyproject.toml` | The dependencies, the suite's dependencies, lambda-emulator's adapter as a group of its own, and pytest's settings. |
| `uv.lock` | What uv resolved, which each host's image installs. |

## Building, running and testing

```sh
uv sync
cd Implementation && RB_PAYLOADS=../../../../tests/payloads PORT=8080 ../.venv/bin/python ../container-h1/server.py
uv run pytest
```

The suite and `rb upgrade` run through [uv](https://docs.astral.sh/uv/), which has to be installed.

`RB_PAYLOADS` names the payload directory, which `settings.py` loads in each worker before it
accepts a connection. `PORT` defaults to 8080.

## Two workers

The container gets two cores, and one Python process runs Python on one core at a time. So
`server.py` runs uvicorn's supervisor with `workers=2`: it binds the socket and starts two worker
processes, and each imports `asgi`, sets Django up and accepts from that socket. The count is
written as 2 rather than read from the machine, because under a CPU quota Python counts every core
the host has. Django's ASGI deployment documentation lists Daphne, Hypercorn and Uvicorn. Daphne
has no worker count of its own, and uvicorn's supervisor does.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's LocMemCache are
both per worker, so two workers answering one path can carry different serials. A connection stays
with the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## Settings

`settings.py` is Django's settings module. `DEBUG` is off and every host is allowed, because the
corpus reaches the container at whatever address it was given. Two of the seven middleware classes
`startproject` installs are kept, because each one runs on every request:

- `CorsMiddleware`, from django-cors-headers, for the cors family. `CORS_URLS_REGEX` keeps it to
  `/cors/`, and on any other path it does nothing.
- `CommonMiddleware`, which writes `Content-Length` on every answer that is not streamed. Django's
  `HttpResponse` writes none, and without one uvicorn sends every answer chunked.

Sessions, CSRF, authentication, messages and the security and clickjacking headers are work the
corpus never asks for, and `CsrfViewMiddleware` would refuse every POST that carries no token.
Logging is Django's default. Under uvicorn it writes nothing for a 4xx while `DEBUG` is off.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The view returns an `HttpResponse` holding the string. | Django |
| json | `JsonResponse`, which serializes the payload with `json` and `DjangoJSONEncoder` on every request. | Django |
| middleware | A no-op middleware made a view decorator with `decorator_from_middleware`, four or sixteen times on the view. | Django |
| parameters | The `<int:...>` path converter, which hands the view an int. | Django |
| headers | The view reads `request.headers` by name and converts the account with `int()`. | by hand |
| query | A `Form` over `request.GET`, which binds and converts each value. | Django |
| body | The view parses the JSON, and a `Form` with a form per line holds the order to orderRequest's rules on the validate routes. | Django |
| authorized | A view decorator that raises `PermissionDenied` for any token but settings.json's. | Django, by hand |
| cache | `cache_page` over LocMemCache, with `vary_on_headers` on the vary routes. | Django |
| compressed | `gzip_page`, at its fixed threshold of 200 bytes and gzip level 6. | Django |
| etag | `ConditionalGetMiddleware`, scoped to the two views with `decorator_from_middleware`. | Django |
| template | Django's own template language, through `render()`. | Django |
| items | A class-based `View` on `/items/<int:id>` with a handler per method, and a `require_POST` view on `/items`. | Django |
| errors | Django's default 404, 400 and 403 pages, and the `View`'s 405. | Django |
| cors | `CorsMiddleware`, kept to `/cors/` by `CORS_URLS_REGEX`. | django-cors-headers |
| forms | A `Form` over `request.POST` and `request.FILES`, which Django parses from either body. | Django |
| stream | `StreamingHttpResponse` typed `application/x-ndjson`, over an async generator of lines. | Django |
| sse | `StreamingHttpResponse` typed `text/event-stream`, over an async generator that frames each row as one event. | Django, by hand |
| static | `django.views.static.serve` over the payload directory. | Django |

## Notes

- Django's router matches the path alone and tries the patterns in the order `urls.py` lists them,
  so the baseline and json routes come first. The method is the view's: `require_GET` and
  `require_POST` refuse the others with 405, and the items `View` answers HEAD with its GET handler.
- `CommonMiddleware` writes `Content-Length: 0` on the 204 of `items.delete` and on the etag
  family's 304. RFC 9110 forbids `Content-Length` on a 204, and allows it on a 304 only as the
  length of the 200.
- `HttpResponse` gives a 204 a `Content-Type` of `text/html; charset=utf-8`.
- `JsonResponse` keeps `json.dumps`'s default separators, so every JSON answer has a space after
  each colon and comma. items.large goes out as 142,764 bytes, where the file holds 129,937.
- `gzip_page` compresses at level 6, which Django hard-codes, so the compressed rows run at level 6
  rather than the fastest level every other framework here uses, and are not read against another
  framework's. As a mitigation for BREACH, it also writes a file name of a random length, under 100
  bytes, into each gzip header, so a compressed answer's length changes from one answer to the next.
- Django answers every error it writes itself, the 404, 400 and 403, with an HTML page, whatever
  the request accepts.
- Django implements no ASGI lifespan and refuses any scope but HTTP, so `server.py` tells uvicorn
  not to ask, and `lambda-emulator/server.py` tells Mangum.
- `django.views.static.serve` is a synchronous view, so Django runs it in a thread. Under ASGI
  Django reads the file it answers with to its end, in a thread, before it sends any of it, and
  warns once in each worker that it consumed a synchronous iterator. Django documents `serve` for
  development. WhiteNoise, the usual answer in production, is a synchronous middleware, and while
  one is installed Django runs every request on every route through a thread.
- A required `BooleanField` refuses `False`, so the items forms declare `inStock` not required.
- On lambda-emulator the application answers behind Mangum 0.22, which reads API Gateway payload
  format 2.0. Mangum buffers the whole answer into one proxy response, so the sse and stream tests
  are listed as unsupported there.
- Mangum posts the body Django writes for HEAD, where uvicorn leaves it unwritten. A Function URL's
  caller reads no body in an answer to HEAD, so nothing reads it.
- Mangum runs every event on asyncio's own event loop, so uvloop, which uvicorn picks on
  container-h1, goes unused on lambda-emulator.
- On lambda-emulator the runtime client puts its log handler on the root logger, so the warning
  Django logs for each 4xx it answers, such as `Not Found: /items/999999`, is written to the
  function's output, with the traceback of a `BadRequest`. Under uvicorn no handler takes them.
- The function on lambda-emulator is one process, which answers one event at a time, so `/__meta`
  reports one worker there.

## Refusals

Every refusal is Django's own. Nothing reshapes it.

- A body that breaks the rules is answered by the view with `JsonResponse(form.errors,
  status=400)`, as Django's documentation answers a form posted by fetch. The body is an object
  keyed by each failing field's name, each holding that field's messages. A bad line is named under
  `lines`, with its position and field in the message.
- A form reports every failure and cannot stop at the first, so `/body/validate/first-error` is
  wired by hand. The view holds the order to the form one field at a time, in the order the fields
  are declared, each time as the form with that one field, and answers the first form that fails.
  The answer is the entry the full check would have listed first.
- A body that is not a JSON object raises `BadRequest`, which Django answers with its 400 page.
- A path no pattern matches is Django's 404 page, and so is a missing row, raised as `Http404`.
- A method the items `View` has no handler for is its 405, with an `Allow` header and no body.
- A wrong token raises `PermissionDenied`, which Django answers with its 403 page. So does a request
  with no token.

## Client

There is no `Client/`. Django writes no OpenAPI document about its own routes without a
third-party library, such as drf-spectacular or django-ninja.
