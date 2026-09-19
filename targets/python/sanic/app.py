"""RequestBench target: Sanic. Framework wiring only; behaviour from _shared/domain.py.

Sanic is the one Python framework here that ships its own server, so this target is the
only one whose adapter is the framework. It runs single-process, like every other target
in the language and like the Node targets.

Every feature family uses Sanic's own facility -- blueprint middleware -- rather than an
``if`` in the handler, and each one is scoped to its own routes. Middleware registered on
the application would put a "did the client ask?" check on all forty-five endpoints and
contaminate the rows the compressed family is measured against, which is the whole reason
those rows have their own paths instead of riding on /json with an accept-encoding header.

The blueprints carry no url_prefix. Scoping is what they are here for, and a prefix would
take the route's own path out of the source, which is where harness/snippets.py finds it.
"""
import gzip
import pathlib

import orjson
from cachetools import TTLCache
from sanic import Blueprint, Sanic, response
from sanic.exceptions import NotFound as RouteMiss
from sanic.exceptions import SanicException

from _hosts import host
from _shared import domain as d

# ---- validation: this target's own walk ----------------------------------------------
#
# Sanic has no validation layer to plug into, so the handler validates and the walk lives
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


# rb:wiring json.*,body.*
# Sanic's own JSON hooks, given orjson. Left alone, Sanic serializes with ujson whenever it
# is installed, and Sanic itself depends on ujson. Sanic documents handing the application
# another library's dumps, with orjson as its example. loads is the same hook for request
# bodies.
app = Sanic("requestbench", dumps=orjson.dumps, loads=orjson.loads)
# Sanic Extensions loads itself whenever it is installed, and it brings more than
# templating. OAS would publish /docs and /openapi.json, and the extras below add
# behaviour to routes this set measures, so only the piece this target asked for is left
# on. The template path is absolute because _hosts/container.py loads this module by file
# path rather than by name.
app.config.OAS = False
app.config.CORS = False
app.config.HTTP_ALL_METHODS = False
app.config.AUTO_EXTEND = True
app.config.TEMPLATING_PATH_TO_TEMPLATES = str(
    pathlib.Path(__file__).resolve().parent / "templates")

META = host.meta("sanic", adapter="sanic",
                 template="jinja2 " + host.dist_version("jinja2"),
                 etag="sha1 (sanic ships no conditional handling)",
                 cache="sanic blueprint middleware over cachetools "
                       + host.dist_version("cachetools"))


# rb:wiring body.*,domain.*
def body_of(request):
    """The request body as a value, or Malformed. Not a validation failure: nothing
    validated it, so it names no field."""
    try:
        return request.json
    except SanicException as e:
        raise d.Malformed(str(e)) from None


# rb:wiring parameters.*,headers.*,middleware.*,authorized.*,json.*
def small(_):
    return response.json(d.payload("small"))


# ---- baseline, json, parameters, query, headers --------------------------------------

@app.get("/plaintext")
async def plaintext(_):
    return response.text("Hello, World!")


@app.get("/health")
async def health(_):
    return response.text("ok")


@app.get("/__meta")
async def meta(_):
    return response.json(META)


# The three sizes are static routes, not /json/<size>. The size set is fixed, so a capture
# would make the router pay parameter cost on the family every other target serves from a
# static route, and it would answer 200 with an empty body for a size that does not exist.
@app.get("/json/small")
async def json_small(_):
    return response.json(d.payload("small"))


@app.get("/json/medium")
async def json_medium(_):
    return response.json(d.payload("medium"))


@app.get("/json/large")
async def json_large(_):
    return response.json(d.payload("large"))


@app.get("/parameters/static/segment/literal")
async def parameters_static(request):
    return small(request)


@app.get("/parameters/<one:int>/segment/literal")
async def parameters_one(request, one):
    return response.json(d.with_echo("small", {"one": one}))


@app.get("/parameters/<one:int>/with-second/<two:int>")
async def parameters_two(request, one, two):
    return response.json(d.with_echo("small", {"one": one, "two": two}))


# Sanic has no binder to plug into: request.args is what it parsed, and the coercion is the
# handler's own work. This is this target's copy on purpose -- sharing one coercer across
# six frameworks measured that function rather than the framework, which is the defect #37
# describes -- and a value that will not parse is the zero value rather than an error
# contract the family does not have. request.args.get answers the first value.

# rb:wiring query.*,domain.*
def _qstr(q, k):
    return q.get(k) or ""


# rb:wiring query.*,domain.*
def _qint(q, k):
    try:
        return int(q.get(k))
    except (TypeError, ValueError):
        return 0


@app.get("/query/one")
async def query_one(request):
    return response.json(d.with_echo("small", {"page": _qint(request.args, "page")}))


@app.get("/query/many")
async def query_many(request):
    q = request.args
    return response.json(d.with_echo("small", {
        "page": _qint(q, "page"),
        "size": _qint(q, "size"),
        "status": _qstr(q, "status"),
        "category": _qstr(q, "category"),
        "sort": _qstr(q, "sort"),
        "q": _qstr(q, "q"),
        "min_price": _qint(q, "min_price"),
        "max_price": _qint(q, "max_price"),
    }))


# The handler reads no header at all. headers.many sends 30 request headers and headers.few
# sends 5, so the difference is the cost of materialising 25 that nobody asked for.
@app.get("/headers")
async def headers(request):
    return small(request)


# Sanic has no header binder, so the handler reads the three headers itself and holds the
# conversion. An account that is missing or will not parse is 0, because the family has no
# error contract to answer with.
@app.get("/headers/bind")
async def headers_bind(request):
    h = request.headers
    try:
        account = int(h.get("x-rb-account"))
    except (TypeError, ValueError):
        account = 0
    return response.json(d.with_echo("small", {"tenant": h.get("x-rb-tenant", ""),
                                               "request_id": h.get("x-rb-request-id", ""),
                                               "account": account}))


# ---- middleware: one blueprint per layer count ---------------------------------------

async def noop(_):
    """One layer: it returns nothing, so Sanic carries on to the next."""


# rb:wiring middleware.*
def layered(name, n):
    bp = Blueprint(name)
    for _ in range(n):
        bp.on_request(noop)
    return bp


middleware_none = Blueprint("middleware_none")
middleware_four = layered("middleware_four", 4)
middleware_sixteen = layered("middleware_sixteen", 16)

middleware_none.get("/middleware/none")(small)
middleware_four.get("/middleware/four")(small)
middleware_sixteen.get("/middleware/sixteen")(small)


# ---- authorized: blueprint middleware, not an if in the handler ----------------------

# rb:wiring authorized.*
authorized = Blueprint("authorized")


@authorized.on_request
# rb:wiring authorized.*
async def require_token(request):
    """Returning a response from request middleware short-circuits the handler, which is
    Sanic's own way to refuse a request before it reaches one."""
    if not d.token_ok(request.headers.get("authorization")):
        return response.json(d.forbidden_body(), status=403)


authorized.get("/authorized/small")(small)


# ---- compressed: a response middleware on its own blueprint --------------------------

# rb:wiring compressed.*
compressed = Blueprint("compressed")

# The floor Starlette and Litestar default to, so compressed.gzip_small lands on the same
# side of it here as it does where the framework compresses.
# rb:wiring compressed.*
GZIP_MIN_SIZE = 500


@compressed.on_response
# rb:wiring compressed.*
async def compress(request, res):
    """Sanic ships no compression, so this target gzips the body itself, at gzip's fastest
    level and with a floor of its own. Whether a framework bothers to compress a body too
    small to benefit is what compressed.gzip_small is in the set to show."""
    if "gzip" not in request.headers.get("accept-encoding", ""):
        return
    if len(res.body) < GZIP_MIN_SIZE:
        return
    res.body = gzip.compress(res.body, compresslevel=1, mtime=0)
    res.headers["content-encoding"] = "gzip"
    res.headers["content-length"] = str(len(res.body))
    res.headers["vary"] = "Accept-Encoding"


# rb:wiring compressed.*
def compressed_route(size):
    async def handler(_):
        return response.json(d.payload(size),
                             headers={"x-rb-serial": d.next_serial()})
    return handler


# rb:handler compressed.*
for _size in ("small", "medium", "large"):
    compressed.get("/compressed/" + _size, name="compressed_" + _size)(
        compressed_route(_size))


# ---- etag: a response middleware on its own blueprint --------------------------------
#
# Sanic ships no conditional-request handling: nothing in it computes a validator or reads
# if-none-match. So the digest is the shared one, declared in /__meta, and what is Sanic's
# own is the scoping -- blueprint middleware, the same way the compressed rows get theirs.
# Shallow, which is the point: the handler has already built the body by the time this runs.

# rb:wiring etag.*
conditional = Blueprint("conditional")


@conditional.on_response
async def revalidate(request, res):
    etag = d.content_etag(res.body)
    res.headers["etag"] = etag
    res.headers["cache-control"] = d.CACHEABLE
    if request.headers.get("if-none-match") == etag:
        res.status = 304
        res.body = b""
        # A 304 carries neither, and Sanic writes the content-type from the response type
        # rather than from the header map, so only one of the two is always there to drop.
        res.headers.pop("content-type", None)
        res.headers.pop("content-length", None)


# rb:wiring etag.*
def etag_route(size):
    async def handler(_):
        return response.json(d.payload(size), headers={"x-rb-serial": d.next_serial()})
    return handler


# rb:handler etag.*
for _size in ("small", "large"):
    conditional.get("/etag/" + _size, name="etag_" + _size)(etag_route(_size))


# ---- cache: a request and a response middleware on one blueprint ----------------------
#
# Sanic ships no response cache either, so the store is an LRU sized from the fixture and
# the wiring is a pair of blueprint middlewares around it: one answers from the store before
# the handler is reached, the other stores what the handler produced. One store for the
# blueprint, so the capacity derived from the key count means what it says.

cached = Blueprint("cached")
# rb:wiring cache.*
store = TTLCache(maxsize=d.cache_spec()["capacity"], ttl=d.cache_spec()["ttl_s"])
#: Path to the header names that path is keyed on. Middleware configuration rather than
#: something a handler decides, which is why it is a table and not an argument.
VARY = {"/cache/vary/" + which: d.vary_on(which) for which in ("one", "many")}


# rb:wiring cache.*
def cache_key(request):
    return "|".join([request.path,
                     *(request.headers.get(n, "") for n in VARY.get(request.path, ()))])


@cached.on_request
async def replay(request):
    hit = store.get(cache_key(request))
    if hit is not None:
        body, content_type, headers = hit
        return response.raw(body, status=200, content_type=content_type, headers=headers)


@cached.on_response
async def keep(request, res):
    key = cache_key(request)
    if res.status == 200 and key not in store:
        # The content type is stored beside the headers rather than inside them: Sanic
        # writes it from the response object, so res.headers does not carry it and a
        # replay built from them alone goes out as application/octet-stream.
        store[key] = (res.body, res.content_type, dict(res.headers))


# rb:wiring cache.*
def cache_route(size, vary=()):
    headers = {"vary": ", ".join(vary)} if vary else {}

    async def handler(_):
        return response.json(d.payload(size),
                             headers={**headers, "x-rb-serial": d.next_serial()})
    return handler


# rb:handler cache.small,cache.medium,cache.large
for _size in ("small", "medium", "large"):
    cached.get("/cache/" + _size, name="cache_" + _size)(cache_route(_size))
# rb:handler cache.vary_one,cache.vary_many
for _which in ("one", "many"):
    _on = d.vary_on(_which)
    cached.get("/cache/vary/" + _which, name="cache_vary_" + _which)(
        cache_route("small", _on))


# ---- body ----------------------------------------------------------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@app.post("/body/bind/small")
async def bind_small(request):
    return response.json(d.bind_echo(body_of(request)))


@app.post("/body/bind/medium")
async def bind_medium(request):
    return response.json(d.bind_echo(body_of(request)))


@app.post("/body/validate/small")
async def validate_small(request):
    return response.json(validated(body_of(request)))


@app.post("/body/validate/medium")
async def validate_medium(request):
    return response.json(validated(body_of(request)))


@app.post("/body/validate/first-error")
async def validate_first(request):
    return response.json(validated(body_of(request), first_error=True))


# ---- domain --------------------------------------------------------------------------

@app.get("/domain/orders")
async def domain_orders(request):
    q = request.args
    return response.json(d.domain_filter(_qint(q, "page"), _qint(q, "size"),
                                         _qstr(q, "status")))


@app.post("/domain/orders")
async def create_order(request):
    out = validated(body_of(request))
    return response.json(out, status=201,
                         headers={"location": d.created_location()})


@app.get("/domain/orders/<oid>")
async def lookup_order(_, oid):
    return response.json(d.get_order(oid))


@app.put("/domain/orders/<oid>")
async def replace_order(request, oid):
    existing = d.get_order(oid)
    return response.json({"id": existing["id"], **validated(body_of(request))})


@app.get("/domain/customers/<cid>/summary")
async def customer_summary(_, cid):
    return response.json(d.domain_join(cid))


@app.get("/domain/regions/<region>/report")
async def region_report(_, region):
    return response.json(d.domain_aggregate(region))


@app.patch("/domain/customers/<cid>")
async def patch_customer(request, cid):
    return response.json(d.patch_customer(cid, body_of(request)))


@app.delete("/domain/orders/<oid>/lines/<lid>")
async def delete_line(_, oid, lid):
    d.get_order_line(oid, lid)
    return response.empty()


# ---- template: Sanic Extensions' own view facility -----------------------------------
#
# Sanic ships no view layer, but Sanic Extensions does and it is the framework's own
# first-party package. app.ext.template names the file and loads it at startup; the
# handler returns the context and never calls a render function. Jinja is the only engine
# Sanic Extensions supports, so it is the framework's choice rather than one made here.

# rb:wiring template.*
# A copy of the payload, not the payload. The renderer inserts the request into the
# context it is handed, and d.payload returns the fixture object the json family
# serializes, so rendering once put a request key in every json.* body until this copied.
TEMPLATE_MODELS = {size: dict(d.payload(size)) for size in ("small", "medium")}


@app.get("/template/small")
@app.ext.template("items.html")
async def template_small(_):
    return TEMPLATE_MODELS["small"]


@app.get("/template/medium")
@app.ext.template("items.html")
async def template_medium(_):
    return TEMPLATE_MODELS["medium"]


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as Sanic's NotFound, which is what gives
# errors.unmatched the same body as errors.not_found.

# rb:handler errors.unmatched
@app.exception(RouteMiss, d.NotFound)
async def not_found(_, __):
    return response.json(d.not_found_body(), status=404)


# rb:wiring errors.*
# The walk this target holds answers a refused body; a body that never parsed answers
# separately, because nothing validated it and it names no field.
@app.exception(Refused)
async def refused(_, exc):
    return response.json(refused_body(exc.errors), status=422)


# rb:wiring errors.*
@app.exception(d.Malformed)
async def malformed(_, exc):
    return response.json(not_bound_body(exc.detail), status=400)


for _bp in (middleware_none, middleware_four, middleware_sixteen, authorized, compressed,
            conditional, cached):
    app.blueprint(_bp)


def serve():
    app.after_server_start(lambda _: host.listening())
    app.run(host="0.0.0.0", port=host.boot("sanic"), single_process=True,
            access_log=False, motd=False)
