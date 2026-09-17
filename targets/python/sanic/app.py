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
import pathlib

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


app = Sanic("requestbench")
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
                 template="jinja2 " + host.dist_version("jinja2"))


def body_of(request):
    """The request body as a value, or Malformed. Not a validation failure: nothing
    validated it, so it names no field."""
    try:
        return request.json
    except SanicException as e:
        raise d.Malformed(str(e)) from None


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


@app.get("/parameters/<one>")
async def parameters_one(request, one):
    return small(request)


@app.get("/parameters/<one>/with-second/<two>")
async def parameters_two(request, one, two):
    return small(request)


# Sanic has no binder to plug into: request.args is what it parsed, and the coercion is the
# handler's own work. This is this target's copy on purpose -- sharing one coercer across
# six frameworks measured that function rather than the framework, which is the defect #37
# describes -- and a value that will not parse is the zero value rather than an error
# contract the family does not have. request.args.get answers the first value.

def _qstr(q, k):
    return q.get(k) or ""


def _qint(q, k):
    try:
        return int(q.get(k))
    except (TypeError, ValueError):
        return 0


@app.get("/query/one")
async def query_one(request):
    return response.json({"page": _qint(request.args, "page")})


@app.get("/query/many")
async def query_many(request):
    q = request.args
    return response.json({
        "page": _qint(q, "page"),
        "size": _qint(q, "size"),
        "status": _qstr(q, "status"),
        "category": _qstr(q, "category"),
        "sort": _qstr(q, "sort"),
        "q": _qstr(q, "q"),
        "min_price": _qint(q, "min_price"),
        "max_price": _qint(q, "max_price"),
    })


# The handler reads no header at all, so headers.many minus headers.few is the cost of
# materialising 27 nobody asked for.
@app.get("/headers")
async def headers(request):
    return small(request)


# ---- middleware: one blueprint per layer count ---------------------------------------

async def noop(_):
    """One layer: it returns nothing, so Sanic carries on to the next."""


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

authorized = Blueprint("authorized")


@authorized.on_request
async def require_token(request):
    """Returning a response from request middleware short-circuits the handler, which is
    Sanic's own way to refuse a request before it reaches one."""
    if not d.token_ok(request.headers.get("authorization")):
        return response.json(d.forbidden_body(), status=403)


authorized.get("/authorized/small")(small)


# ---- compressed: a response middleware on its own blueprint --------------------------

compressed = Blueprint("compressed")


@compressed.on_response
async def compress(request, res):
    """Sanic ships no compression, so the codec is the pinned one every language shares.
    The threshold is pinned too: whether a framework bothers to compress a body too small
    to benefit is what compressed.gzip_small is in the set to show."""
    if "gzip" not in request.headers.get("accept-encoding", ""):
        return
    if len(res.body) < d.GZIP_MIN_SIZE:
        return
    res.body = d.gzip(res.body)
    res.headers["content-encoding"] = "gzip"
    res.headers["content-length"] = str(len(res.body))
    res.headers["vary"] = "Accept-Encoding"


def compressed_route(size):
    async def handler(_):
        return response.json(d.payload(size),
                             headers={"x-rb-serial": d.next_serial()})
    return handler


# rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
# rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
for _size in ("small", "medium", "large"):
    compressed.get("/compressed/" + _size, name="compressed_" + _size)(
        compressed_route(_size))


# ---- cached: validator headers and the conditional -----------------------------------

def cached_route(size):
    """The ETag is pinned in the fixture, so this measures emitting the header and
    comparing it rather than hashing the body.

    The comparison requires a non-empty header: matching a missing if-none-match against an
    empty ETag answers 304 to a client that never asked a conditional question.
    """
    etag = d.etag_of(size)

    async def handler(request):
        validators = {"etag": etag, "cache-control": d.CACHEABLE,
                      "x-rb-serial": d.next_serial()}
        if request.headers.get("if-none-match") == etag:
            return response.empty(status=304, headers=validators)
        return response.json(d.payload(size), headers=validators)
    return handler


# rb:snippet cached.small cached.medium cached.large cached.revalidate
for _size in ("small", "medium", "large"):
    app.get("/cached/" + _size, name="cached_" + _size)(cached_route(_size))


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

# rb:snippet errors.unmatched
@app.exception(RouteMiss, d.NotFound)
async def not_found(_, __):
    return response.json(d.not_found_body(), status=404)


# The walk this target holds answers a refused body; a body that never parsed answers
# separately, because nothing validated it and it names no field.
@app.exception(Refused)
async def refused(_, exc):
    return response.json(refused_body(exc.errors), status=422)


@app.exception(d.Malformed)
async def malformed(_, exc):
    return response.json(not_bound_body(exc.detail), status=400)


for _bp in (middleware_none, middleware_four, middleware_sixteen, authorized, compressed):
    app.blueprint(_bp)


def serve():
    app.run(host="0.0.0.0", port=host.boot("sanic"), single_process=True,
            access_log=False, motd=False)
