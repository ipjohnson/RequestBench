# Django REST framework

Django REST framework 3.18.1 on Django 6.1.1 and CPython 3.14, served by gunicorn 26.2.0 with two
worker processes of four threads each, answering the RequestBench corpus. The contract every route
follows is [`frameworks/openapi.json`](../../openapi.json).

Django REST framework, DRF for short, is a toolkit for writing web APIs on Django. A DRF view wraps
Django's request in its own `Request`, whose parsers read the body into `request.data`, runs its
content negotiation, authentication, permission and throttle classes, and then the handler. The
handler returns a `Response` holding plain data, which the renderer DRF negotiated writes out. A
`Serializer` binds and validates what comes in, and DRF's exception handler answers what it raises.
DRF's views are synchronous, so Django serves them over WSGI here, where
[`django-asgi`](../django-asgi) serves Django's own async views over ASGI.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `wsgi.py` is what each worker loads, `settings.py` configures Django and DRF and loads the payloads, `urls.py` routes every path, `renderers.py` holds the two renderers DRF does not ship, and `views/` holds one module per corpus family. |
| `container-h1/` | How container-h1 starts it. `server.py` starts gunicorn with two workers, and `Dockerfile` builds the image. |
| `container-h2/` | How container-h2 starts it. `server.py` starts gunicorn as container-h1's does, serving HTTP/2 with prior knowledge and no TLS, and `Dockerfile` builds the image with the `container-h2` group, which adds gunicorn's http2 extra. |
| `lambda-emulator/` | How lambda-emulator starts it. `server.py` is the handler's module, which puts Django's WSGI application behind apig-wsgi for awslambdaric, the runtime client, and `Dockerfile` builds the function on the `python:3.14` base image, with the packages and the application together in the task root. |
| `UnitTests/` | pytest tests of the wiring, sending each request through DRF's `APIClient`. |
| `client-exception/` | How the corpus reads DRF's error bodies. |
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

Django's deployment documentation covers gunicorn for WSGI. The container gets two cores, and one
Python process runs Python on one core at a time. So `server.py` runs gunicorn's master with two
workers: the master binds the socket and forks the workers, and each worker imports `wsgi`, sets
Django up and accepts from that socket. The count is written as 2 rather than read from the
machine, because under a CPU quota Python counts every core the host has.

The workers are gunicorn's gthread workers, with four threads each, as in [`flask`](../flask).
gunicorn's default sync worker answers one request at a time and closes the connection after every
answer. The gthread worker keeps a connection open between requests, on the worker that accepted
it, and hands each request to a thread of its pool. gunicorn documents 2 to 4 threads per core, and
four is the low end of that range for the container's two cores.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's LocMemCache are
both per worker, so two workers answering one path can carry different serials. A connection stays
with the worker that accepted it, and the gate sends each test's two requests on one connection, so
`fresh()` and `replayed()` hold. Under load each worker fills its own store.

## Settings

`settings.py` is Django's settings module, with DRF's settings under `REST_FRAMEWORK`. `DEBUG` is
off and every host is allowed, because the corpus reaches the container at whatever address it was
given. `INSTALLED_APPS` holds `rest_framework`, as DRF's installation guide lists it, and
`corsheaders`. No database is configured, and nothing asks for one.

DRF installs two renderers and two authentication classes by default. `settings.py` keeps
`JSONRenderer` alone. The other renderer, the browsable API, answers a request that accepts HTML
with a page in place of the JSON. It keeps no authentication class, because DRF's two defaults read
Django's sessions and users, which are not installed. DRF's settings guide sets
`UNAUTHENTICATED_USER` to `None` in that case, and so does `settings.py`. The permission class stays
DRF's default, `AllowAny`.

Two of the seven middleware classes `startproject` installs are kept, because each one runs on
every request:

- `CorsMiddleware`, from django-cors-headers, for the cors family. `CORS_URLS_REGEX` keeps it to
  `/cors/`, and on any other path it does nothing.
- `CommonMiddleware`, which writes `Content-Length` on every answer that is not streamed. Django
  writes none, and without one gunicorn sends every answer chunked.

Sessions, CSRF, authentication, messages and the security and clickjacking headers are work the
corpus never asks for.

## How each family is wired

Most views are functions under DRF's `@api_view`. The items resource is a `ViewSet`, which DRF's
`SimpleRouter` routes. DRF has no cache, compression, conditional requests, middleware or file
serving of its own, so those families use Django's. DRF's caching guide puts Django's `cache_page`
on the function `@api_view` wraps, inside DRF's view, and the other Django view decorators here sit
in the same place.

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The view returns a `Response` holding the string, and `PlainTextRenderer`, the custom renderer DRF's renderer guide writes, sends it as `text/plain`. | DRF |
| json | The view returns a `Response` holding the payload, which `JSONRenderer` writes with the standard library's `json`. | DRF |
| middleware | A no-op Django middleware made a view decorator with `decorator_from_middleware`, four or sixteen times on the function `@api_view` wraps. | Django |
| parameters | Django's `<int:...>` path converter, which hands the view an int. | Django |
| headers | The view reads `request.headers` by name and converts the account with `int()`. | by hand |
| query | A `Serializer` over `request.query_params`, which binds and converts each value. | DRF |
| body | `JSONParser` parses the order into `request.data`, and a `Serializer` binds it, with types alone on the bind routes and orderRequest's rules on the validate routes. | DRF |
| authorized | A permission class on the view, which compares the bearer token with settings.json's. | DRF, by hand |
| cache | `cache_page` over LocMemCache, with `vary_on_headers` on the vary routes. | Django |
| compressed | `gzip_page`, at its fixed threshold of 200 bytes and gzip level 6. | Django |
| etag | `ConditionalGetMiddleware`, scoped to the two functions with `decorator_from_middleware`. | Django |
| template | `TemplateHTMLRenderer`, which renders the template the `Response` names with Django's template language. | DRF, Django |
| items | A `ViewSet` with an action per method, routed by `SimpleRouter`, with a `Serializer` for each body and `partial=True` on the patch. | DRF |
| errors | Django's 404 page for a path no pattern matches, and DRF's exception handler for `NotFound`, `MethodNotAllowed` and `ParseError`. | Django, DRF |
| cors | `CorsMiddleware`, kept to `/cors/` by `CORS_URLS_REGEX`, which DRF's documentation recommends. | django-cors-headers |
| forms | `FormParser` and `MultiPartParser` parse each body into `request.data`, and a `Serializer` binds the fields and the upload. | DRF |
| stream | `StreamingHttpResponse` typed `application/x-ndjson`, over a generator that renders each row with `JSONRenderer`. | Django, DRF |
| sse | `StreamingHttpResponse` typed `text/event-stream`, over a generator that frames each row as one event, with `EventStreamRenderer` on the view. | Django, by hand |
| static | `django.views.static.serve` over the payload directory. | Django |

## Notes

- DRF writes an `Allow` header on every answer from a view, naming the methods the view answers.
  `@api_view` keeps a function view's methods in a set, so the order follows Python's hash seed and
  changes from one worker process to the next, as `GET, OPTIONS` or `OPTIONS, GET`.
- A function view under `@api_view(["GET"])` answers HEAD with 405, because `@api_view` adds only
  OPTIONS to the methods it is given. The items `ViewSet` answers HEAD with `retrieve`.
- Django writes the body of a GET for HEAD, and gunicorn 26.2 drops it. gunicorn logs `WSGI app sent
  body bytes on a no-body response` for every such answer, so each `items.head` request writes a line
  to the container's output, on container-h1 and on container-h2.
- A cache hit still runs DRF's view around `cache_page`: the request wrapper, the content
  negotiation, the permission check and the `Allow` header. `cache_page` also writes `Expires` and
  `Cache-Control: max-age=3600` on every answer it stores.
- `gzip_page` compresses at level 6, which Django hard-codes, so the compressed rows run at level 6
  rather than the fastest level most frameworks here use. As a mitigation for BREACH, it also writes
  a file name of a random length, under 100 bytes, into each gzip header, so a compressed answer's
  length changes from one answer to the next.
- `CommonMiddleware` writes `Content-Length: 0` on the etag family's 304. RFC 9110 allows
  `Content-Length` on a 304 only as the length of the 200. gunicorn drops the one it writes on the
  204 of `items.delete`.
- An OPTIONS request that `CorsMiddleware` does not answer reaches the view, and DRF answers it with
  200 and a JSON description of the view: its name, and what it renders and parses.
- `items.create` answers with an absolute `Location`, which DRF's `reverse` builds from the request's
  host.
- `JSONRenderer` writes no space after a separator and leaves non-ASCII unescaped, so items.large
  goes out as 128,510 bytes, where the file holds 129,937 and `django-asgi`'s `JsonResponse` writes
  142,764.
- On lambda-emulator the application answers behind apig-wsgi 2.20, which reads API Gateway payload
  format 2.0 and hands Django each event as a WSGI request. apig-wsgi buffers the whole answer into
  one proxy response, so the sse and stream tests are listed as unsupported there.
- apig-wsgi keeps only the last value of a response header the application repeats, other than
  `Set-Cookie`. No answer here repeats one.
- On lambda-emulator the runtime client puts its log handler on the root logger, so the warning
  Django logs for each 4xx, such as `Not Found: /items/999999`, is written to the function's output.
  Under gunicorn no handler takes them.
- The function on lambda-emulator is one process on one thread, which answers one event at a time,
  so `/__meta` reports one worker and one thread there.
- gunicorn 26.2 serves HTTP/2 with prior knowledge and no TLS through `http2_cleartext`, which needs
  the h2 library from its http2 extra. It serves it only to a peer in `forwarded_allow_ips`. On
  container-h2 a published port's peer is Docker's gateway, so every peer is trusted. gunicorn then
  also honours the `X-Forwarded-*` headers it reads, and the corpus sends none of them.

## Refusals

Every refusal is DRF's or Django's own. Nothing reshapes it.

- A body that breaks the rules is the `ValidationError` that `is_valid(raise_exception=True)`
  raises, which DRF's exception handler answers with 400 and the serializer's errors: an object
  keyed by each failing field's name, holding that field's messages. An empty list of lines is named
  under `lines.non_field_errors`, and a bad line under `lines`, keyed by its index.
- A serializer reports every failure and cannot stop at the first, so `/body/validate/first-error`
  is wired by hand. Its serializer overrides `to_internal_value`, DRF's hook for turning a body into
  validated data, to run each field's own validation in the order the fields are declared, and raises
  the first failure as DRF raises any. The answer is the entry the full check would have listed
  first.
- A body that is not JSON is `JSONParser`'s `ParseError`, which DRF answers with 400 and a `detail`
  message.
- A path no pattern matches is Django's 404 page, in HTML. DRF answers only inside its views.
- A missing row is DRF's `NotFound`, a 404 with a `detail` message.
- A method the items `ViewSet` has no action for is DRF's `MethodNotAllowed`, a 405 with a `detail`
  message and an `Allow` header.
- A request without the accepted bearer token is refused by the permission class, which DRF answers
  with 403 and a `detail` message. DRF's `TokenAuthentication` keeps its tokens in a database table
  and answers a wrong one with 401, where the corpus asks for 403, so the permission class compares
  the token itself.

## Client

There is no `Client/`. DRF's own OpenAPI schema generator is deprecated in favour of drf-spectacular,
a third-party package, and DRF's documentation says the built-in one will be retired.
