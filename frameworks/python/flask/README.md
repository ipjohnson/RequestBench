# Flask

Flask 3.1.3 on CPython 3.14, served by gunicorn 26.2.0 with two worker processes of four threads
each, answering the RequestBench corpus. The contract every route follows is
[`frameworks/openapi.json`](../../openapi.json).

Flask is a WSGI framework from the Pallets projects, built on Werkzeug and Jinja2. A view reads what
it needs from the request Werkzeug parsed, and a view that returns a dict is answered as JSON. Flask
has no validation of its own, so the bodies are bound by Flask-Pydantic, the Pallets community's
extension for Pydantic.

## Layout

| Path | What it is |
| --- | --- |
| `Implementation/` | The application. `app.py` builds the application each worker serves, and `routes/` holds one blueprint per corpus family. |
| `container-h1/` | How container-h1 starts it. `server.py` starts gunicorn with two workers, and `Dockerfile` builds the image. |
| `lambda-emulator/` | How lambda-emulator starts it. `server.py` is the handler's module, which puts the application behind apig-wsgi for awslambdaric, the runtime client, and `Dockerfile` builds the function on the `python:3.14` base image, with the packages and the application together in the task root. |
| `UnitTests/` | pytest tests of the wiring, sending each request through Flask's test client. |
| `client-exception/` | How the corpus reads the refusals of Flask and Flask-Pydantic. |
| `pyproject.toml` | The dependencies, the suite's dependencies, lambda-emulator's adapter as a group of its own, and pytest's settings. |
| `uv.lock` | What uv resolved, which each host's image installs. |

There is no `Client/`. Flask writes no OpenAPI document about its routes without a third-party
library, such as APIFlask, flask-openapi3 or flask-smorest.

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

Flask ships no production server, and its deployment documentation lists gunicorn first. The
container gets two cores, and one Python process runs Python on one core at a time. So `server.py`
runs gunicorn's master with two workers: the master binds the socket and forks the workers, and each
worker builds the application, loads the payloads and accepts from that socket. The count is written
as 2 rather than read from the machine, because under a CPU quota Python counts every core the host
has.

The workers are gunicorn's gthread workers, with four threads each. gunicorn's default sync worker
answers one request at a time and closes the connection after every answer. The gthread worker keeps
a connection open between requests, on the worker that accepted it, and hands each request to a
thread of its pool. gunicorn documents 2 to 4 threads per core, and four is the low end of that range
for the container's two cores. A worker runs Python on one core at a time, so more threads would only
queue for it.

Each worker keeps its own state. The `x-rb-serial` counter and the cache family's store are both per
worker, so two workers answering one path can carry different serials. The gate sends each test's two
requests on one connection, so `fresh()` and `replayed()` hold. Under load each worker fills its own
store.

## How each family is wired

| Family | Mechanism | Whose |
| --- | --- | --- |
| baseline | The view returns the string with a `text/plain` content type. | Flask |
| json | The view returns the payload as a dict, and Flask's `DefaultJSONProvider` writes it with the standard library's `json`. | Flask |
| middleware | One nested blueprint per layer count, with that many no-op `before_request` hooks. | Flask |
| parameters, headers | Werkzeug's `int` converter on each capture, and Werkzeug's `Headers` read by name, the account converted by `get`'s `type` argument. | Werkzeug |
| query | Werkzeug's `MultiDict.get`, reading each value by name and converting the numbers. | Werkzeug |
| body | Flask-Pydantic's `validate` decorator, which binds the order to a Pydantic model before the view runs, with types alone on the bind routes and orderRequest's rules on the validate routes. | Flask-Pydantic, Pydantic |
| authorized | A `before_request` hook on the family's blueprint, which compares the bearer token Werkzeug parsed and aborts with 403. | by hand |
| cache | Flask-Caching's `cached` decorator over a `SimpleCache` in each worker, which stores the response the view returned. | Flask-Caching |
| compressed | Flask-Compress's `compressed` decorator on the two views, at gzip's fastest level and Flask-Compress's default threshold of 500 bytes. | Flask-Compress |
| etag | An `after_request` hook on the family's blueprint, which calls Werkzeug's `add_etag`, a SHA-1 of the body, and `make_conditional`. | Werkzeug |
| template | `render_template`, with the Jinja2 environment Flask builds for the application. | Flask, Jinja2 |
| items | One view per method on `/items/<int:id>`. Flask answers HEAD with the GET view, and Flask-Pydantic binds the bodies. | Flask |
| errors | Werkzeug's router's 404 and 405, Flask's 400 for a body that is not JSON, and `abort(404)` in the items views. | Flask, Werkzeug |
| cors | Flask-CORS on the family's blueprint. | Flask-CORS |
| forms | Werkzeug parses the form and the upload, and the view reads each value by name, converting the numbers. | Werkzeug |
| stream | The view returns a generator of lines in a `Response` typed `application/x-ndjson`, which gunicorn sends chunked. | Flask |
| sse | The view returns a generator of event text in a `Response` typed `text/event-stream`. | by hand |
| static | Flask's own static route, `/static/<path:filename>`, over the payload directory, which the application names as its static folder. | Flask |

## Notes

- Flask's JSON provider sorts the keys of every object it writes, because `DefaultJSONProvider.sort_keys`
  defaults to true. The corpus compares JSON by structure, so the answers pass, and every JSON row
  pays for the sort.
- Every error Flask writes itself is one of Werkzeug's HTML pages, whatever the request asked for:
  the 404, the 405, the 403 and the 400 for a body that is not JSON. Only Flask-Pydantic's refusal is
  JSON.
- Flask answers a 204 with `Content-Type: text/html; charset=utf-8`, its default for a response, though
  the answer has no body.
- Flask answers HEAD by running the GET view, which builds and serialises the row, and Werkzeug then
  leaves the body unwritten.
- Werkzeug builds the `Allow` header of a 405, and of the OPTIONS answer Flask writes, from a set.
  The methods' order follows Python's hash seed, so it changes from one worker process to the next.
- Flask-Caching's `SimpleCache` pickles what it stores. A replayed answer is a response unpickled on
  every hit, not stored bytes written back.
- Flask-CORS writes `Vary: Origin` only when the policy allows more than one origin or a pattern.
  settings.json names one origin, so an answer that differs by Origin says nothing of it, and
  `cors.vary` is skipped.
- Flask-Compress adds `Vary: Accept-Encoding` to every answer it looks at, compressed or not.
- gunicorn's gthread worker closes a connection that has been idle for 2 seconds, its `keepalive`
  default.
- On lambda-emulator the application answers behind apig-wsgi 2.20, which reads API Gateway payload
  format 2.0 and hands Flask each event as a WSGI request. apig-wsgi buffers the whole answer into
  one proxy response, so the sse and stream tests are listed as unsupported there.
- Flask's documentation names no Lambda adapter. apig-wsgi is a maintained WSGI one that reads
  payload format 2.0 itself and answers `Set-Cookie` in that format's `cookies`. serverless-wsgi,
  another, answers payload format 2.0 without `cookies`.
- apig-wsgi keeps only the last value of a response header the application repeats, other than
  `Set-Cookie`. No answer here repeats one.
- The function on lambda-emulator is one process on one thread, which answers one event at a time,
  so `/__meta` reports one worker and one thread there.

## Refusals

Every refusal is Flask's, Werkzeug's or Flask-Pydantic's own. Nothing reshapes it.

- A body that breaks the rules is Flask-Pydantic's 400, with Pydantic's list of every failure under
  `validation_error.body_params`, each naming its field in `loc`.
- Pydantic cannot stop at the first failure, so `/body/validate/first-error` is wired by hand. Its
  model checks the rules one field at a time, each as a model of that field alone, and raises
  Pydantic's `ValidationError` holding the first failure. Flask-Pydantic answers that as it answers
  any other failed body. The answer is the entry the full check would have listed first.
- A body that is not JSON is Flask's 400 page. Flask-Pydantic reads the body through
  `request.get_json()`, which raises Werkzeug's `BadRequest` before any model runs.
- A path no route matches is Werkzeug's 404 page, and a method the path has no route for its 405
  page.
- A missing row is `abort(404)`, Werkzeug's 404 page.
- A request without the accepted bearer token is `abort(403)`, Werkzeug's 403 page. Flask ships no
  authorization. Flask-HTTPAuth, the extension Flask's ecosystem uses for tokens, answers a wrong
  token with 401 where the corpus asks for 403, so the family's hook compares the token itself.
