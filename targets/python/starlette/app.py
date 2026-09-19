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
import pathlib

from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response
from starlette.routing import Route
from starlette.templating import Jinja2Templates

from cachetools import TTLCache
import orjson

from _hosts import host
from _shared import domain as d
from _shared.asgi import ConditionalGet, ResponseCache

# ---- responses: JSONResponse rendered by orjson --------------------------------------
#
# Starlette documents subclassing JSONResponse and overriding render to use a third-party
# JSON library, with orjson as its example. Every JSON body this target answers is one.

# rb:wiring json.*
class OrjsonResponse(JSONResponse):
    def render(self, content):
        return orjson.dumps(content)


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


# rb:wiring body.*,errors.*
def refused_body(errors):
    return {"error": "validation_failed", "errors": errors}


def not_bound_body(detail):
    return {"error": "invalid_body", "detail": detail}


# rb:wiring body.*
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


# rb:wiring body.*,domain.*
def validated(body, first_error=False):
    """The order, or Refused naming every field the walk would not accept."""
    errs = check_order(body, first_error)
    if errs:
        raise Refused(errs)
    return d.price_order(body["customer_id"], body["status"], body["lines"])


META = host.meta("starlette", adapter="uvicorn",
                 template="jinja2 " + host.dist_version("jinja2"),
                 etag="sha1 (starlette ships no conditional handling)",
                 cache="starlette middleware over cachetools "
                       + host.dist_version("cachetools"))


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

# rb:wiring middleware.*
class Noop:
    """One layer: it calls the next and does nothing else."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)


# rb:wiring middleware.*
def layers(n):
    return [Middleware(Noop) for _ in range(n)]


# rb:wiring authorized.*
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
        await OrjsonResponse(d.forbidden_body(), status_code=403)(scope, receive, send)


# ---- handlers ------------------------------------------------------------------------

async def plaintext(_: Request):
    return PlainTextResponse("Hello, World!")


async def health(_: Request):
    return PlainTextResponse("ok")


async def meta(_: Request):
    return OrjsonResponse(META)


# rb:wiring parameters.*,headers.*,middleware.*,authorized.*
async def small(_: Request):
    return OrjsonResponse(d.payload("small"))


async def parameters_one(request: Request):
    return OrjsonResponse(d.with_echo("small", {"one": request.path_params["one"]}))


async def parameters_two(request: Request):
    p = request.path_params
    return OrjsonResponse(d.with_echo("small", {"one": p["one"], "two": p["two"]}))


# Starlette has no header binder, so the handler reads the three headers itself and holds the
# conversion. An account that is missing or will not parse is 0, because the family has no
# error contract to answer with.
# rb:handler headers.bind_few,headers.bind_many
async def headers_bind(request: Request):
    h = request.headers
    try:
        account = int(h.get("x-rb-account"))
    except (TypeError, ValueError):
        account = 0
    return OrjsonResponse(d.with_echo("small", {"tenant": h.get("x-rb-tenant", ""),
                                                "request_id": h.get("x-rb-request-id", ""),
                                                "account": account}))


# rb:wiring json.*
def payload_route(size):
    """The three sizes are static routes, not /json/{size}. The size set is fixed, so a
    capture would make the router pay parameter cost on the family every other target
    serves from a static route, and it would answer 200 with an empty body for a size that
    does not exist."""
    async def handler(_: Request):
        return OrjsonResponse(d.payload(size))
    return handler


# Starlette has no binder to plug into: request.query_params is what it parsed, and the
# coercion is the handler's own work. This is this target's copy on purpose -- sharing one
# coercer across six frameworks measured that function rather than the framework, which is
# the defect #37 describes -- and a value that will not parse is the zero value rather than
# an error contract the family does not have.

# rb:wiring query.*,domain.*
def _qstr(q, k):
    return q.get(k) or ""


# rb:wiring query.*,domain.*
def _qint(q, k):
    try:
        return int(q.get(k))
    except (TypeError, ValueError):
        return 0


# rb:handler query.one
async def query_one(request: Request):
    return OrjsonResponse(d.with_echo("small",
                                      {"page": _qint(request.query_params, "page")}))


# rb:handler query.many
async def query_many(request: Request):
    q = request.query_params
    return OrjsonResponse(d.with_echo("small", {
        "page": _qint(q, "page"),
        "size": _qint(q, "size"),
        "status": _qstr(q, "status"),
        "category": _qstr(q, "category"),
        "sort": _qstr(q, "sort"),
        "q": _qstr(q, "q"),
        "min_price": _qint(q, "min_price"),
        "max_price": _qint(q, "max_price"),
    }))


# rb:wiring compressed.*
def compressed_route(size):
    """Compression is the framework's, at gzip's fastest level and Starlette's own size
    floor. Whether a framework bothers to compress a body too small to benefit is what
    compressed.gzip_small is in the set to show."""
    async def handler(_: Request):
        return OrjsonResponse(d.payload(size), headers={"x-rb-serial": d.next_serial()})
    return handler


# ---- etag and cache: middleware on the route, which is Starlette's own scoping --------
#
# Starlette ships neither a conditional-request handler for a dynamic response nor a
# response cache, so both middlewares are held in _shared/asgi.py. What is Starlette's own
# is where they are attached: Route takes its own middleware list, so each reaches the
# feature's routes and nothing else without a mount or a sub-application in the way.
#
# One store for the target, sized from the fixture, shared by every instance below: the
# capacity derived from the key count means what it says only if there is one store to
# count against.

# rb:wiring etag.*
CONDITIONAL = [Middleware(ConditionalGet)]
# rb:wiring cache.*
STORE = TTLCache(maxsize=d.cache_spec()["capacity"], ttl=d.cache_spec()["ttl_s"])


# rb:wiring etag.*
def etag_route(size):
    async def handler(_: Request):
        return OrjsonResponse(d.payload(size), headers={
            "cache-control": d.CACHEABLE, "x-rb-serial": d.next_serial()})
    return handler


# rb:wiring cache.*
def cache_route(size, vary=()):
    headers = {"vary": ", ".join(vary)} if vary else {}

    async def handler(_: Request):
        return OrjsonResponse(d.payload(size),
                              headers={**headers, "x-rb-serial": d.next_serial()})
    return handler


# rb:wiring cache.*
def cache_scoped(path, vary=()):
    return [Middleware(ResponseCache, store=STORE, vary={path: vary})]


# rb:wiring template.*
# Starlette's own view facility. Jinja2Templates is what it ships for server-side
# rendering and TemplateResponse is what reaches it; FastAPI re-exports this same class.
# Compiled on first render and cached by the environment: a precomputed string would
# measure nothing.
templates = Jinja2Templates(
    directory=str(pathlib.Path(__file__).resolve().parent / "templates"))


# rb:wiring template.*
def template_route(size):
    # A copy of the payload, not the payload. Jinja2Templates inserts the request into the
    # context it is handed, and d.payload returns the fixture object the json family
    # serializes, so rendering once put a request key in every json.* body until this copied.
    body = dict(d.payload(size))

    async def handler(request: Request):
        return templates.TemplateResponse(request, "items.html", body)
    return handler


# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.
async def bind(request: Request):
    return OrjsonResponse(d.bind_echo(await body_of(request)))


async def validate_all(request: Request):
    return OrjsonResponse(validated(await body_of(request)))


async def validate_first(request: Request):
    return OrjsonResponse(validated(await body_of(request), first_error=True))


async def domain_orders(request: Request):
    q = request.query_params
    return OrjsonResponse(d.domain_filter(_qint(q, "page"), _qint(q, "size"),
                                          _qstr(q, "status")))


async def create_order(request: Request):
    out = validated(await body_of(request))
    return OrjsonResponse(out, status_code=201,
                          headers={"location": d.created_location()})


async def lookup_order(request: Request):
    return OrjsonResponse(d.get_order(request.path_params["oid"]))


async def replace_order(request: Request):
    existing = d.get_order(request.path_params["oid"])
    out = validated(await body_of(request))
    return OrjsonResponse({"id": existing["id"], **out})


async def customer_summary(request: Request):
    return OrjsonResponse(d.domain_join(request.path_params["cid"]))


async def region_report(request: Request):
    return OrjsonResponse(d.domain_aggregate(request.path_params["region"]))


async def patch_customer(request: Request):
    body = await body_of(request)
    return OrjsonResponse(d.patch_customer(request.path_params["cid"], body))


async def delete_line(request: Request):
    d.get_order_line(request.path_params["oid"], request.path_params["lid"])
    return Response(status_code=204)


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as an HTTPException, which is what gives
# errors.unmatched the same body as errors.not_found.

# rb:wiring errors.*
async def http_error(_: Request, exc: HTTPException):
    body = d.not_found_body() if exc.status_code == 404 else {"error": "internal"}
    return OrjsonResponse(body, status_code=exc.status_code)


async def not_found(_: Request, __: Exception):
    return OrjsonResponse(d.not_found_body(), status_code=404)


# rb:wiring errors.*
# The walk this target holds answers a refused body; a body that never parsed answers
# separately, because nothing validated it and it names no field.
async def refused(_: Request, exc: Refused):
    return OrjsonResponse(refused_body(exc.errors), status_code=422)


# rb:wiring errors.*
async def malformed(_: Request, exc: d.Malformed):
    return OrjsonResponse(not_bound_body(exc.detail), status_code=400)


# rb:wiring compressed.*
gzip_scoped = [Middleware(GZipMiddleware, compresslevel=1)]

routes = [
    get("/plaintext", plaintext),
    get("/health", health),
    get("/__meta", meta),
    get("/json/small", payload_route("small")),
    get("/json/medium", payload_route("medium")),
    get("/json/large", payload_route("large")),
    get("/parameters/static/segment/literal", small),
    get("/parameters/{one:int}/segment/literal", parameters_one),
    get("/parameters/{one:int}/with-second/{two:int}", parameters_two),
    get("/query/one", query_one),
    get("/query/many", query_many),
    # The handler reads no header at all. headers.many sends 30 request headers and
    # headers.few sends 5, so the difference is the cost of materialising 25 that nobody
    # asked for.
    get("/headers", small),
    get("/headers/bind", headers_bind),
    get("/middleware/none", small),
    get("/middleware/four", small, middleware=layers(4)),
    get("/middleware/sixteen", small, middleware=layers(16)),
    get("/authorized/small", small, middleware=[Middleware(RequireToken)]),
    get("/compressed/small", compressed_route("small"), middleware=gzip_scoped),
    get("/compressed/medium", compressed_route("medium"), middleware=gzip_scoped),
    get("/compressed/large", compressed_route("large"), middleware=gzip_scoped),
    # rb:handler etag.*
    get("/etag/small", etag_route("small"), middleware=CONDITIONAL),
    get("/etag/large", etag_route("large"), middleware=CONDITIONAL),
    # rb:handler cache.small,cache.medium,cache.large
    get("/cache/small", cache_route("small"), middleware=cache_scoped("/cache/small")),
    get("/cache/medium", cache_route("medium"), middleware=cache_scoped("/cache/medium")),
    get("/cache/large", cache_route("large"), middleware=cache_scoped("/cache/large")),
    # rb:handler cache.vary_one,cache.vary_many
    get("/cache/vary/one", cache_route("small", d.vary_on("one")),
        middleware=cache_scoped("/cache/vary/one", d.vary_on("one"))),
    get("/cache/vary/many", cache_route("small", d.vary_on("many")),
        middleware=cache_scoped("/cache/vary/many", d.vary_on("many"))),
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

# rb:handler errors.unmatched
app = Starlette(routes=routes, exception_handlers={
    HTTPException: http_error,
    d.NotFound: not_found,
    Refused: refused,
    d.Malformed: malformed,
})


def serve():
    host.run_uvicorn(app, host="0.0.0.0", port=host.boot("starlette"),
                     log_level="warning", access_log=False)
