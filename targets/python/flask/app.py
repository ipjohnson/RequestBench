"""RequestBench target: Flask. Framework wiring only; behaviour from _shared/domain.py.

Flask is the one WSGI framework in the set. It runs under gunicorn, which its own
deployment documentation names first, with one worker and a thread pool: gunicorn's default
sync worker serves one request at a time, and an open-loop ladder against that measures a
queue of depth one rather than Flask. The thread count is pinned here rather than left to
gunicorn's default of 1 for the same reason the gzip level is pinned.

Flask has no route-scoped middleware. A blueprint's before_request and after_request hooks
are its per-scope facility, and that is what the authorized, compressed and middleware
families use. Hooks registered on the application would put a "did the client ask?" check
on all forty-five endpoints and contaminate the rows the compressed family is measured
against.

The blueprints carry no url_prefix. Scoping is what they are here for, and a prefix would
take the route's own path out of the source, which is where harness/snippets.py finds it.
"""
import gunicorn.app.base
from flask import Blueprint, Flask, Response, jsonify, request
from werkzeug.exceptions import BadRequest, HTTPException

from _hosts import host
from _shared import domain as d

# ---- validation: this target's own walk ----------------------------------------------
#
# Flask has no validation layer to plug into, so the handler validates and the walk lives
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


#: One process, and enough threads that the worker is not itself the queue.
THREADS = 16

app = Flask(__name__)
META = host.meta("flask", adapter="gunicorn")


def body_of():
    """The request body as a value, or Malformed. Not a validation failure: nothing
    validated it, so it names no field."""
    try:
        return request.get_json()
    except BadRequest as e:
        raise d.Malformed(str(e)) from None


def small():
    return jsonify(d.payload("small"))


def no_content():
    """A 204 carries no body, so it declares no type. Flask's Response defaults to
    text/html, which describes a body it is not allowed to send."""
    response = Response(status=204)
    del response.headers["content-type"]
    return response


# ---- baseline, json, parameters, query, headers --------------------------------------

@app.get("/plaintext")
def plaintext():
    return Response("Hello, World!", mimetype="text/plain")


@app.get("/health")
def health():
    return Response("ok", mimetype="text/plain")


@app.get("/__meta")
def meta():
    return jsonify(META)


# The three sizes are static routes, not /json/<size>. The size set is fixed, so a capture
# would make the router pay parameter cost on the family every other target serves from a
# static route, and it would answer 200 with an empty body for a size that does not exist.
@app.get("/json/small")
def json_small():
    return jsonify(d.payload("small"))


@app.get("/json/medium")
def json_medium():
    return jsonify(d.payload("medium"))


@app.get("/json/large")
def json_large():
    return jsonify(d.payload("large"))


@app.get("/parameters/static/segment/literal")
def parameters_static():
    return small()


@app.get("/parameters/<one>")
def parameters_one(one):
    return small()


@app.get("/parameters/<one>/with-second/<two>")
def parameters_two(one, two):
    return small()


# The framework parses the query string, which is the work this family is here to measure;
# the domain coerces what it parsed, so all six targets answer the same values.
@app.get("/query/one")
def query_one():
    return jsonify(d.coerce_one(request.args))


@app.get("/query/many")
def query_many():
    return jsonify(d.coerce_many(request.args))


# The handler reads no header at all, so headers.many minus headers.few is the cost of
# materialising 27 nobody asked for.
@app.get("/headers")
def headers():
    return small()


# ---- middleware: one blueprint per layer count ---------------------------------------

def noop():
    """One layer: it returns nothing, so Flask carries on to the next."""


def layered(name, n):
    bp = Blueprint(name, __name__)
    for _ in range(n):
        bp.before_request(noop)
    return bp


middleware_none = Blueprint("middleware_none", __name__)
middleware_four = layered("middleware_four", 4)
middleware_sixteen = layered("middleware_sixteen", 16)

middleware_none.get("/middleware/none")(small)
middleware_four.get("/middleware/four")(small)
middleware_sixteen.get("/middleware/sixteen")(small)


# ---- authorized: a blueprint hook, not an if in the handler --------------------------

authorized = Blueprint("authorized", __name__)


@authorized.before_request
def require_token():
    """Returning a response from before_request short-circuits the view, which is Flask's
    own way to refuse a request before it reaches one."""
    if not d.token_ok(request.headers.get("authorization")):
        return jsonify(d.forbidden_body()), 403


authorized.get("/authorized/small")(small)


# ---- compressed: a response hook on its own blueprint --------------------------------

compressed = Blueprint("compressed", __name__)


@compressed.after_request
def compress(response):
    """Flask ships no compression, so the codec is the pinned one every language shares. The
    threshold is pinned too: whether a framework bothers to compress a body too small to
    benefit is what compressed.gzip_small is in the set to show."""
    if "gzip" not in request.headers.get("accept-encoding", ""):
        return response
    body = response.get_data()
    if len(body) < d.GZIP_MIN_SIZE:
        return response
    response.set_data(d.gzip(body))
    response.headers["content-encoding"] = "gzip"
    response.headers["vary"] = "Accept-Encoding"
    return response


def compressed_route(size):
    def handler():
        return jsonify(d.payload(size)), 200, {"x-rb-serial": d.next_serial()}
    return handler


# rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
# rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
for _size in ("small", "medium", "large"):
    compressed.get("/compressed/" + _size,
                   endpoint="compressed_" + _size)(compressed_route(_size))


# ---- cached: validator headers and the conditional -----------------------------------

def cached_route(size):
    """The ETag is pinned in the fixture, so this measures emitting the header and comparing
    it rather than hashing the body.

    The comparison requires a non-empty header: matching a missing if-none-match against an
    empty ETag answers 304 to a client that never asked a conditional question.
    """
    etag = d.etag_of(size)

    def handler():
        validators = {"etag": etag, "cache-control": d.CACHEABLE,
                      "x-rb-serial": d.next_serial()}
        if request.headers.get("if-none-match") == etag:
            return "", 304, validators
        return jsonify(d.payload(size)), 200, validators
    return handler


# rb:snippet cached.small cached.medium cached.large cached.revalidate
for _size in ("small", "medium", "large"):
    app.get("/cached/" + _size, endpoint="cached_" + _size)(cached_route(_size))


# ---- body ----------------------------------------------------------------------------
#
# bind parses and binds without validating, so validate minus bind is the validator alone
# rather than the validator plus the parse.

@app.post("/body/bind/small")
def bind_small():
    return jsonify(d.bind_echo(body_of()))


@app.post("/body/bind/medium")
def bind_medium():
    return jsonify(d.bind_echo(body_of()))


@app.post("/body/validate/small")
def validate_small():
    return jsonify(validated(body_of()))


@app.post("/body/validate/medium")
def validate_medium():
    return jsonify(validated(body_of()))


@app.post("/body/validate/first-error")
def validate_first():
    return jsonify(validated(body_of(), first_error=True))


# ---- domain --------------------------------------------------------------------------

@app.get("/domain/orders")
def domain_orders():
    return jsonify(d.domain_filter(request.args))


@app.post("/domain/orders")
def create_order():
    out = validated(body_of())
    return jsonify(out), 201, {"location": d.created_location()}


@app.get("/domain/orders/<oid>")
def lookup_order(oid):
    return jsonify(d.get_order(oid))


@app.put("/domain/orders/<oid>")
def replace_order(oid):
    existing = d.get_order(oid)
    return jsonify({"id": existing["id"], **validated(body_of())})


@app.get("/domain/customers/<cid>/summary")
def customer_summary(cid):
    return jsonify(d.domain_join(cid))


@app.get("/domain/regions/<region>/report")
def region_report(region):
    return jsonify(d.domain_aggregate(region))


@app.patch("/domain/customers/<cid>")
def patch_customer(cid):
    return jsonify(d.patch_customer(cid, body_of()))


@app.delete("/domain/orders/<oid>/lines/<lid>")
def delete_line(oid, lid):
    d.get_order_line(oid, lid)
    return no_content()


# ---- template: the engine named in /__meta -------------------------------------------

@app.get("/template/small")
def template_small():
    return Response(host.render_items(d.payload("small")), mimetype="text/html")


@app.get("/template/medium")
def template_medium():
    return Response(host.render_items(d.payload("medium")), mimetype="text/html")


# ---- failures ------------------------------------------------------------------------
#
# Views raise and never build a 404 or a 422 themselves, so the six Python targets cannot
# drift. The router's own miss arrives here as a werkzeug HTTPException, which is what gives
# errors.unmatched the same body as errors.not_found.

# rb:snippet errors.unmatched
@app.errorhandler(HTTPException)
def http_error(exc):
    body = d.not_found_body() if exc.code == 404 else {"error": "internal"}
    return jsonify(body), exc.code


@app.errorhandler(d.NotFound)
def not_found(_):
    return jsonify(d.not_found_body()), 404


# The walk this target holds answers a refused body; a body that never parsed answers
# separately, because nothing validated it and it names no field.
@app.errorhandler(Refused)
def refused(exc):
    return jsonify(refused_body(exc.errors)), 422


@app.errorhandler(d.Malformed)
def malformed(exc):
    return jsonify(not_bound_body(exc.detail)), 400


for _bp in (middleware_none, middleware_four, middleware_sixteen, authorized, compressed):
    app.register_blueprint(_bp)


class Gunicorn(gunicorn.app.base.BaseApplication):
    """gunicorn's documented way to start it from Python rather than from its own command
    line, so one entrypoint covers every Python target."""

    def __init__(self, application, settings):
        # Not self.wsgi: BaseApplication.wsgi() is the method gunicorn calls to fetch the
        # application, and an attribute of that name shadows it.
        self.application, self.settings = application, settings
        super().__init__()

    def load_config(self):
        for k, v in self.settings.items():
            self.cfg.set(k, v)

    def load(self):
        return self.application


def serve():
    Gunicorn(app, {
        "bind": "0.0.0.0:%d" % host.boot("flask"),
        "workers": 1,
        "worker_class": "gthread",
        "threads": THREADS,
        "accesslog": None,
        "loglevel": "warning",
    }).run()
