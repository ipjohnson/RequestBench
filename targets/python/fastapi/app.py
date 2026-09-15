"""RequestBench target: FastAPI. Framework wiring only; behaviour from _shared/domain.py.

Every feature family here uses FastAPI's own facility rather than an ``if`` in the handler,
and each one is scoped to its own routes. Compression added to the application would put a
"did the client ask?" check on all forty-five endpoints and contaminate the rows the
compressed family is measured against, which is the whole reason those rows have their own
paths instead of riding on /json with an accept-encoding header.

Two of those facilities are worth naming, because FastAPI has no route-scoped middleware
and the substitutes are what the numbers describe:

  middleware  A dependency list on the route. Dependencies are what FastAPI composes
              per-route layers out of, and `dependencies=[Depends(noop)] * n` is how a
              reader of the documentation would add n of them.
  compressed  A mounted sub-application carrying GZipMiddleware. Mounting is FastAPI's own
              way to scope middleware, and the extra dispatch it costs lands in
              compressed.identity_* -- which is the honest price of not taxing the other
              forty-two endpoints.
"""
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from _hosts import host
from _shared import domain as d

# The documentation routes are off: they are three more entries in the router the
# benchmark never asks for, and /docs is not part of the endpoint set.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

META = host.meta("fastapi", adapter="uvicorn")


def small():
    return d.payload("small")


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets
# cannot drift. The router's own miss arrives here as an HTTPException, which is what
# gives errors.unmatched the same body as errors.not_found.

# rb:snippet errors.unmatched
STATUS_BODY = {403: d.forbidden_body, 404: d.not_found_body}


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    body = STATUS_BODY.get(exc.status_code)
    return JSONResponse(body() if body else {"error": "internal"},
                        status_code=exc.status_code)


@app.exception_handler(d.NotFound)
async def not_found(_: Request, __: d.NotFound):
    return JSONResponse(d.not_found_body(), status_code=404)


@app.exception_handler(d.Invalid)
async def invalid(_: Request, exc: d.Invalid):
    return JSONResponse(d.invalid_body(exc.errors), status_code=422)


# FastAPI parses the request body itself, so a body that is not JSON fails inside the
# framework rather than in the domain. This is what gives errors.malformed the same 422
# body as body.rejected_all, which is the comparison that row exists for.
@app.exception_handler(RequestValidationError)
async def malformed(_: Request, __: RequestValidationError):
    return JSONResponse(d.invalid_body(d.malformed().errors), status_code=422)


# ---- baseline, json, parameters, query, headers --------------------------------------

@app.get("/plaintext", response_class=PlainTextResponse)
async def plaintext():
    return "Hello, World!"


@app.get("/health", response_class=PlainTextResponse)
async def health():
    return "ok"


@app.get("/__meta")
async def meta():
    return META


# The three sizes are static routes, not /json/{size}. The size set is fixed, so a capture
# would make the router pay parameter cost on the family every other target serves from a
# static route, and it would answer 200 with an empty body for a size that does not exist.
@app.get("/json/small")
async def json_small():
    return d.payload("small")


@app.get("/json/medium")
async def json_medium():
    return d.payload("medium")


@app.get("/json/large")
async def json_large():
    return d.payload("large")


@app.get("/parameters/static/segment/literal")
async def parameters_static():
    return small()


@app.get("/parameters/{one}")
async def parameters_one():
    return small()


@app.get("/parameters/{one}/with-second/{two}")
async def parameters_two():
    return small()


# The framework parses the query string, which is the work this family is here to measure;
# the domain coerces what it parsed, so all six targets answer the same values.
@app.get("/query/one")
async def query_one(request: Request):
    return d.coerce_one(request.query_params)


@app.get("/query/many")
async def query_many(request: Request):
    return d.coerce_many(request.query_params)


# The handler reads no header at all, so headers.many minus headers.few is the cost of
# materialising 27 nobody asked for.
@app.get("/headers")
async def headers():
    return small()


# ---- middleware: a dependency per layer, scoped to the route -------------------------

async def noop():
    """One layer: it is resolved and does nothing else."""


def layers(n):
    return [Depends(noop) for _ in range(n)]


@app.get("/middleware/none")
async def middleware_none():
    return small()


@app.get("/middleware/four", dependencies=layers(4))
async def middleware_four():
    return small()


@app.get("/middleware/sixteen", dependencies=layers(16))
async def middleware_sixteen():
    return small()


# ---- authorized: a route dependency, not an if in the handler ------------------------

async def require_token(request: Request):
    if not d.token_ok(request.headers.get("authorization")):
        raise HTTPException(status_code=403)


@app.get("/authorized/small", dependencies=[Depends(require_token)])
async def authorized_small():
    return small()


# ---- compressed: GZipMiddleware on a mounted sub-application -------------------------

# Threshold and level are the pinned ones rather than Starlette's defaults. Whether a
# framework bothers to compress a body too small to benefit is what compressed.gzip_small
# is in the set to show, so the floor has to be the same floor everywhere or the row
# reports a default instead.
gzipped = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
gzipped.add_middleware(GZipMiddleware, minimum_size=d.GZIP_MIN_SIZE,
                       compresslevel=d.GZIP_LEVEL)


def compressed_route(size):
    async def handler(response: Response):
        response.headers["x-rb-serial"] = d.next_serial()
        return d.payload(size)
    return handler


# rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
# rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
for _size in ("small", "medium", "large"):
    gzipped.add_api_route("/" + _size, compressed_route(_size), methods=["GET"])

app.mount("/compressed", gzipped)


# ---- cached: validator headers and the conditional -----------------------------------

def cached_route(size):
    """The ETag is pinned in the fixture, so this measures emitting the header and
    comparing it rather than hashing the body.

    The comparison requires a non-empty header: matching a missing if-none-match against an
    empty ETag answers 304 to a client that never asked a conditional question.
    """
    etag = d.etag_of(size)

    async def handler(request: Request, response: Response):
        headers = {"etag": etag, "cache-control": d.CACHEABLE,
                   "x-rb-serial": d.next_serial()}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        response.headers.update(headers)
        return d.payload(size)
    return handler


# rb:snippet cached.small cached.medium cached.large cached.revalidate
for _size in ("small", "medium", "large"):
    app.add_api_route("/cached/" + _size, cached_route(_size), methods=["GET"])


# ---- body: bind, validate, and the two rejection contracts ---------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@app.post("/body/bind/small")
async def bind_small(body: dict):
    return d.bind_echo(body)


@app.post("/body/bind/medium")
async def bind_medium(body: dict):
    return d.bind_echo(body)


@app.post("/body/validate/small")
async def validate_small(body: dict):
    return d.validate_order(body)


@app.post("/body/validate/medium")
async def validate_medium(body: dict):
    return d.validate_order(body)


@app.post("/body/validate/first-error")
async def validate_first(body: dict):
    return d.validate_order(body, first_error=True)


# ---- domain --------------------------------------------------------------------------

@app.get("/domain/orders")
async def domain_orders(request: Request):
    return d.domain_filter(request.query_params)


@app.post("/domain/orders", status_code=201)
async def create_order(body: dict, response: Response):
    out = d.validate_order(body)
    response.headers["location"] = d.created_location()
    return out


@app.get("/domain/orders/{oid}")
async def lookup_order(oid: str):
    return d.get_order(oid)


@app.put("/domain/orders/{oid}")
async def replace_order(oid: str, body: dict):
    existing = d.get_order(oid)
    return {"id": existing["id"], **d.validate_order(body)}


@app.get("/domain/customers/{cid}/summary")
async def customer_summary(cid: str):
    return d.domain_join(cid)


@app.get("/domain/regions/{region}/report")
async def region_report(region: str):
    return d.domain_aggregate(region)


@app.patch("/domain/customers/{cid}")
async def patch_customer(cid: str, body: dict):
    return d.patch_customer(cid, body)


# response_class, because FastAPI's default is JSONResponse and that declares a
# content-type on a response that by definition has no body.
@app.delete("/domain/orders/{oid}/lines/{lid}", status_code=204, response_class=Response)
async def delete_line(oid: str, lid: str):
    d.get_order_line(oid, lid)


# ---- template: the engine named in /__meta -------------------------------------------

@app.get("/template/small", response_class=HTMLResponse)
async def template_small():
    return host.render_items(d.payload("small"))


@app.get("/template/medium", response_class=HTMLResponse)
async def template_medium():
    return host.render_items(d.payload("medium"))


def serve():
    uvicorn.run(app, host="0.0.0.0", port=host.boot("fastapi"),
                log_level="warning", access_log=False)
