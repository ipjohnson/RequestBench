"""RequestBench target: Starlette. Framework wiring only; behaviour from _shared/domain.py.

Starlette is the one Python framework here with real route-scoped middleware, so every
feature family is scoped with ``Route(..., middleware=[...])``. Compression added to the
application would put a "did the client ask?" check on all forty-five endpoints and
contaminate the rows the compressed family is measured against, which is the whole reason
those rows have their own paths instead of riding on /json with an accept-encoding header.

The method helpers below exist so a registration says which method it binds. A bare
``Route(path, handler, methods=["GET"])`` writes the method inside a string, and
/domain/orders is then two registrations that nothing can tell apart -- including
harness/snippets.py, which refuses to guess which of them serves domain.filter.
"""
import uvicorn
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response
from starlette.routing import Route

from _hosts import host
from _shared import domain as d

# ---- validation: this target's own walk ----------------------------------------------
#
# Starlette has no validation layer to plug into, so the handler validates and the walk lives
# here. It is this target's copy on purpose: sharing one across six frameworks measured the
# shared walk rather than the framework, which is the defect #35 describes.
#
# Reading the body as a value rather than decoding it into a shape means every wrong field
# is seen, not only the first one a decoder tripped on. That is what keeps
# body.rejected_all and body.rejected_first different here.


def _err(field, rule):
    return {"field": field, "rule": rule}


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _req_field(errs, m, field, typ):
    v = m.get(field)
    if v is None:
        errs.append(_err(field, "required"))
    elif typ == "int" and not _is_int(v):
        errs.append(_err(field, "int"))
    elif typ == "string" and not isinstance(v, str):
        errs.append(_err(field, "string"))
    elif typ == "array" and not isinstance(v, list):
        errs.append(_err(field, "array"))


class Refused(Exception):
    """A body this target's walk refused, and the fields it named."""

    def __init__(self, errors):
        super().__init__("validation failed")
        self.errors = errors


def refused_body(errors):
    return {"error": "validation_failed", "errors": errors}


def not_bound_body(detail):
    return {"error": "invalid_body", "detail": detail}


def check_order(body, first_error=False):
    """Every field that is wrong, or the first one when asked for that."""
    m = body if isinstance(body, dict) else {}
    errs = []

    def bail():
        return first_error and errs

    _req_field(errs, m, "customer_id", "int")
    if not bail():
        _req_field(errs, m, "status", "string")
    if not bail():
        _req_field(errs, m, "lines", "array")

    rows = m.get("lines")
    if isinstance(rows, list) and not bail():
        if not rows:
            errs.append(_err("lines", "min_length"))
        for i, line in enumerate(rows):
            if bail():
                break
            line = line if isinstance(line, dict) else {}
            if not _is_int(line.get("product_id")):
                errs.append(_err("lines[%d].product_id" % i, "int"))
            qty = line.get("qty")
            if not bail() and not (_is_int(qty) and qty >= 1):
                errs.append(_err("lines[%d].qty" % i, "min"))
    return errs


def validated(body, first_error=False):
    """The order, or Refused naming every field the walk would not accept."""
    errs = check_order(body, first_error)
    if errs:
        raise Refused(errs)
    return d.price_order(body["customer_id"], body["status"], body["lines"])


META = host.meta("starlette", adapter="uvicorn")


def get(path, endpoint, **kw):
    return Route(path, endpoint, methods=["GET"], **kw)


def post(path, endpoint, **kw):
    return Route(path, endpoint, methods=["POST"], **kw)


def put(path, endpoint, **kw):
    return Route(path, endpoint, methods=["PUT"], **kw)


def patch(path, endpoint, **kw):
    return Route(path, endpoint, methods=["PATCH"], **kw)


def delete(path, endpoint, **kw):
    return Route(path, endpoint, methods=["DELETE"], **kw)


async def body_of(request):
    """The request body as a value, or Malformed. Not a validation failure: nothing
    validated it, so it names no field."""
    try:
        return await request.json()
    except ValueError as e:
        raise d.Malformed(str(e)) from None


# ---- middleware ----------------------------------------------------------------------

class Noop:
    """One layer: it calls the next and does nothing else."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)


def layers(n):
    return [Middleware(Noop) for _ in range(n)]


class RequireToken:
    """Starlette middleware, not a check inside the handler. An ``if`` in the handler would
    measure the language; the point of the authorized family is the framework's plumbing.

    ``starlette.authentication.requires`` is the other way in, but it needs
    AuthenticationMiddleware on the application, which would put a credential lookup on all
    forty-five endpoints.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        header = Request(scope).headers.get("authorization")
        if d.token_ok(header):
            return await self.app(scope, receive, send)
        await JSONResponse(d.forbidden_body(), status_code=403)(scope, receive, send)


# ---- handlers ------------------------------------------------------------------------

async def plaintext(_: Request):
    return PlainTextResponse("Hello, World!")


async def health(_: Request):
    return PlainTextResponse("ok")


async def meta(_: Request):
    return JSONResponse(META)


async def small(_: Request):
    return JSONResponse(d.payload("small"))


def payload_route(size):
    """The three sizes are static routes, not /json/{size}. The size set is fixed, so a
    capture would make the router pay parameter cost on the family every other target
    serves from a static route, and it would answer 200 with an empty body for a size that
    does not exist."""
    async def handler(_: Request):
        return JSONResponse(d.payload(size))
    return handler


async def query_one(request: Request):
    return JSONResponse(d.coerce_one(request.query_params))


async def query_many(request: Request):
    return JSONResponse(d.coerce_many(request.query_params))


def compressed_route(size):
    """Compression is the framework's, configured to the pinned level and the pinned floor.
    Whether a framework bothers to compress a body too small to benefit is what
    compressed.gzip_small is in the set to show, so the floor has to be the same floor
    everywhere or the row reports a default instead."""
    async def handler(_: Request):
        return JSONResponse(d.payload(size), headers={"x-rb-serial": d.next_serial()})
    return handler


def cached_route(size):
    """Sets the validators and answers the conditional. The ETag is pinned in the fixture,
    so what this measures is emitting the header and comparing it rather than hashing a
    body.

    The comparison requires a non-empty header: matching a missing if-none-match against an
    empty ETag answers 304 to a client that never asked a conditional question.
    """
    etag = d.etag_of(size)

    async def handler(request: Request):
        headers = {"etag": etag, "cache-control": d.CACHEABLE,
                   "x-rb-serial": d.next_serial()}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        return JSONResponse(d.payload(size), headers=headers)
    return handler


def template_route(size):
    async def handler(_: Request):
        return HTMLResponse(host.render_items(d.payload(size)))
    return handler


# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.
async def bind(request: Request):
    return JSONResponse(d.bind_echo(await body_of(request)))


async def validate_all(request: Request):
    return JSONResponse(validated(await body_of(request)))


async def validate_first(request: Request):
    return JSONResponse(validated(await body_of(request), first_error=True))


async def domain_orders(request: Request):
    return JSONResponse(d.domain_filter(request.query_params))


async def create_order(request: Request):
    out = validated(await body_of(request))
    return JSONResponse(out, status_code=201,
                        headers={"location": d.created_location()})


async def lookup_order(request: Request):
    return JSONResponse(d.get_order(request.path_params["oid"]))


async def replace_order(request: Request):
    existing = d.get_order(request.path_params["oid"])
    out = validated(await body_of(request))
    return JSONResponse({"id": existing["id"], **out})


async def customer_summary(request: Request):
    return JSONResponse(d.domain_join(request.path_params["cid"]))


async def region_report(request: Request):
    return JSONResponse(d.domain_aggregate(request.path_params["region"]))


async def patch_customer(request: Request):
    body = await body_of(request)
    return JSONResponse(d.patch_customer(request.path_params["cid"], body))


async def delete_line(request: Request):
    d.get_order_line(request.path_params["oid"], request.path_params["lid"])
    return Response(status_code=204)


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as an HTTPException, which is what gives
# errors.unmatched the same body as errors.not_found.

async def http_error(_: Request, exc: HTTPException):
    body = d.not_found_body() if exc.status_code == 404 else {"error": "internal"}
    return JSONResponse(body, status_code=exc.status_code)


async def not_found(_: Request, __: Exception):
    return JSONResponse(d.not_found_body(), status_code=404)


# The walk this target holds answers a refused body; a body that never parsed answers
# separately, because nothing validated it and it names no field.
async def refused(_: Request, exc: Refused):
    return JSONResponse(refused_body(exc.errors), status_code=422)


async def malformed(_: Request, exc: d.Malformed):
    return JSONResponse(not_bound_body(exc.detail), status_code=400)


gzip_scoped = [Middleware(GZipMiddleware, minimum_size=d.GZIP_MIN_SIZE,
                          compresslevel=d.GZIP_LEVEL)]

routes = [
    get("/plaintext", plaintext),
    get("/health", health),
    get("/__meta", meta),
    get("/json/small", payload_route("small")),
    get("/json/medium", payload_route("medium")),
    get("/json/large", payload_route("large")),
    get("/parameters/static/segment/literal", small),
    get("/parameters/{one}", small),
    get("/parameters/{one}/with-second/{two}", small),
    get("/query/one", query_one),
    get("/query/many", query_many),
    # The handler reads no header at all, so headers.many minus headers.few is the cost of
    # materialising 27 nobody asked for.
    get("/headers", small),
    get("/middleware/none", small),
    get("/middleware/four", small, middleware=layers(4)),
    get("/middleware/sixteen", small, middleware=layers(16)),
    get("/authorized/small", small, middleware=[Middleware(RequireToken)]),
    get("/compressed/small", compressed_route("small"), middleware=gzip_scoped),
    get("/compressed/medium", compressed_route("medium"), middleware=gzip_scoped),
    get("/compressed/large", compressed_route("large"), middleware=gzip_scoped),
    get("/cached/small", cached_route("small")),
    get("/cached/medium", cached_route("medium")),
    get("/cached/large", cached_route("large")),
    get("/template/small", template_route("small")),
    get("/template/medium", template_route("medium")),
    post("/body/bind/small", bind),
    post("/body/bind/medium", bind),
    post("/body/validate/small", validate_all),
    post("/body/validate/medium", validate_all),
    post("/body/validate/first-error", validate_first),
    get("/domain/orders", domain_orders),
    post("/domain/orders", create_order),
    get("/domain/orders/{oid}", lookup_order),
    put("/domain/orders/{oid}", replace_order),
    get("/domain/customers/{cid}/summary", customer_summary),
    get("/domain/regions/{region}/report", region_report),
    patch("/domain/customers/{cid}", patch_customer),
    delete("/domain/orders/{oid}/lines/{lid}", delete_line),
]

# rb:snippet errors.unmatched
app = Starlette(routes=routes, exception_handlers={
    HTTPException: http_error,
    d.NotFound: not_found,
    Refused: refused,
    d.Malformed: malformed,
})


def serve():
    uvicorn.run(app, host="0.0.0.0", port=host.boot("starlette"),
                log_level="warning", access_log=False)
