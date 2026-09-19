# FastAPI

A Python framework over Starlette, with routing by decorator and per-request work composed
out of dependencies. The type annotation on a handler's parameter is the binding: a name
that matches a path segment is a capture, anything else is bound from the body or the
query and coerced by pydantic.

## How it is wired

Routes are `@app.get("/path")` and its siblings, with `{name}` for captures. A handler
returns a plain value and FastAPI serializes it; where a family needs a header, the
handler takes `response: Response` and sets it, and where it needs to answer 304 it
returns a `Response` of its own.

The body families declare a Pydantic model, so FastAPI parses, binds and validates the
request itself. That is what makes `errors.malformed` FastAPI's failure rather than the
domain's, and a `RequestValidationError` handler is what gives it the same 422 envelope as
`body.rejected_all`.

## What is unusual about it

**FastAPI has no route-scoped middleware**, and the two families that need one say so
differently.

`middleware.four` and `middleware.sixteen` carry `dependencies=[Depends(noop)] * n`.
Dependencies are what FastAPI composes per-route layers out of, so what those rows measure
is the solver walking n of them. It is not an ASGI middleware chain, and the number is not
comparable to `middleware.four` on a framework where it is.

`compressed.*` is a mounted sub-application carrying `GZipMiddleware`. Mounting is
FastAPI's own way to scope middleware, and the extra dispatch it costs lands in
`compressed.identity_*` — which is the price of not putting a "did the client ask?" check
on the other forty-two endpoints. The level is gzip's fastest, and the size floor is
Starlette's own default.

**Every handler that returns a value declares its return type, and that is what keeps
`jsonable_encoder` off the path.** Without a declared type, `serialize_response` walks the
whole value into JSON-ready primitives before `json.dumps` sees it. On the large payload
that walk cost about ten times the dump that follows it: 5.7ms against 0.56ms on the
machine this was written on. With a declared type and no `response_class`, FastAPI
validates the value against the type and Pydantic writes the JSON bytes in one pass. That
is what FastAPI's documentation recommends for
[JSON performance](https://fastapi.tiangolo.com/advanced/custom-response/#orjson-or-response-model).
The type is `dict`, which Pydantic reads as `dict[Any, Any]`, so the validation copies the
top level of the value and nothing more.

Returning `JSONResponse(...)` from the handler would also skip the encoder, because FastAPI
passes a Response through untouched. That is what the Starlette target does, because it is
Starlette's own API. Doing it here would make `python:fastapi` a measurement of Starlette
wearing FastAPI's router.

**The JSON family is three static routes, not `/json/{size}`.** A capture would make the
router pay parameter cost on the family that anchors most of the endpoint set, and it
would answer 200 with an empty body for a size that does not exist.

**The documentation routes are off.** `/docs`, `/redoc` and `/openapi.json` are three more
entries in the router that nothing in the endpoint set asks for.

## The server

FastAPI ships no server. This target runs uvicorn, which its own quickstart installs, with
one process and no reload — the same shape as the Node targets. `/__meta` reports it as
the adapter, so a step in the numbers can be attributed to a uvicorn release rather than
to FastAPI.

## Bundle note

The `fastapi` bundle holds the target's own `app.py`, the shared domain module every
Python target calls, the host module they all render templates with, and
`requirements.in`/`requirements.txt`. The lockfile is one resolution for all six targets,
so a difference between two of them is the framework rather than a transitive dependency
one happened to pick up.
