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
from sanic import Blueprint, Sanic, response
from sanic.exceptions import NotFound as RouteMiss
from sanic.exceptions import SanicException

from _hosts import host
from _shared import domain as d

app = Sanic("requestbench")
META = host.meta("sanic", adapter="sanic")


def body_of(request):
    """The request body as a value, or the 422 every target answers when it is not JSON."""
    try:
        return request.json
    except SanicException:
        raise d.malformed() from None


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


# The framework parses the query string, which is the work this family is here to measure;
# the domain coerces what it parsed, so all six targets answer the same values.
@app.get("/query/one")
async def query_one(request):
    return response.json(d.coerce_one(request.args))


@app.get("/query/many")
async def query_many(request):
    return response.json(d.coerce_many(request.args))


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
    return response.json(d.validate_order(body_of(request)))


@app.post("/body/validate/medium")
async def validate_medium(request):
    return response.json(d.validate_order(body_of(request)))


@app.post("/body/validate/first-error")
async def validate_first(request):
    return response.json(d.validate_order(body_of(request), first_error=True))


# ---- domain --------------------------------------------------------------------------

@app.get("/domain/orders")
async def domain_orders(request):
    return response.json(d.domain_filter(request.args))


@app.post("/domain/orders")
async def create_order(request):
    out = d.validate_order(body_of(request))
    return response.json(out, status=201,
                         headers={"location": d.created_location()})


@app.get("/domain/orders/<oid>")
async def lookup_order(_, oid):
    return response.json(d.get_order(oid))


@app.put("/domain/orders/<oid>")
async def replace_order(request, oid):
    existing = d.get_order(oid)
    return response.json({"id": existing["id"], **d.validate_order(body_of(request))})


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


# ---- template: the engine named in /__meta -------------------------------------------

@app.get("/template/small")
async def template_small(_):
    return response.html(host.render_items(d.payload("small")))


@app.get("/template/medium")
async def template_medium(_):
    return response.html(host.render_items(d.payload("medium")))


# ---- failures ------------------------------------------------------------------------
#
# Handlers raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as Sanic's NotFound, which is what gives
# errors.unmatched the same body as errors.not_found.

# rb:snippet errors.unmatched
@app.exception(RouteMiss, d.NotFound)
async def not_found(_, __):
    return response.json(d.not_found_body(), status=404)


@app.exception(d.Invalid)
async def invalid(_, exc):
    return response.json(d.invalid_body(exc.errors), status=422)


for _bp in (middleware_none, middleware_four, middleware_sixteen, authorized, compressed):
    app.blueprint(_bp)


def serve():
    app.run(host="0.0.0.0", port=host.boot("sanic"), single_process=True,
            access_log=False, motd=False)
