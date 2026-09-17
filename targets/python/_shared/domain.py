"""Behaviour shared by every Python target. Frameworks differ only in how they bind routes
to these functions, so the measured delta is framework overhead.

A port of ``targets/rust/_shared/src/lib.rs``, which is itself a port of the Go domain. The
Node target is what every fingerprint was first compared against, so where the languages
could differ -- field order in a 422 body, an empty list versus a missing one, the tiebreak
in a sort -- this follows Node.

Failures are exceptions rather than a sentinel return. Every framework here registers
handlers for them, which is the facility Fastify's ``setErrorHandler`` is, so a handler
never builds a 404 or a 422 itself and the six targets cannot drift.
"""
import gzip as _gzip
import hashlib
import itertools
import json
import os

# ---- fixture -------------------------------------------------------------------------

_DATA = None


class _Data:
    __slots__ = ("orders", "customers", "next_order_id", "products_by_id",
                 "customers_by_id", "orders_by_id", "payloads", "token", "cache")

    def __init__(self, f):
        self.orders = f["orders"]
        self.customers = f["customers"]
        # The fixture holds orders 1..1000, so a created one is 1001: synthetic and
        # deterministic, which is all a Location header needs when nothing is persisted.
        self.next_order_id = len(self.orders) + 1
        self.products_by_id = {p["id"]: p for p in f["products"]}
        self.customers_by_id = {c["id"]: c for c in self.customers}
        self.orders_by_id = {o["id"]: o for o in self.orders}
        self.payloads = f["payloads"]
        self.token = f["auth"]["token"]
        self.cache = f["cache"]


def fixture_path():
    """The path the fixture is read from, honouring the same variable every language uses.

    A host decides the layout, so the path relative to this file is not the same
    everywhere and RB_FIXTURE wins when it is set.
    """
    return os.environ.get("RB_FIXTURE", "../../spec/fixture.json")


def load(path):
    """Read the fixture once."""
    global _DATA
    with open(path, "rb") as fh:
        _DATA = _Data(json.load(fh))


def data():
    return _DATA


# Read at import, the way the Node domain does, because a target builds its routes at
# import too: the cached family closes over an ETag from the fixture while the module is
# still executing, which is long before anything binds a port.
try:
    load(fixture_path())
except OSError as _e:
    raise SystemExit("fixture: %s" % _e) from None


# ---- errors --------------------------------------------------------------------------

class NotFound(Exception):
    """Every lookup that misses. Handlers never spell the 404 themselves."""


def not_found_body():
    return {"error": "not_found"}


def forbidden_body():
    return {"error": "forbidden"}


class Malformed(Exception):
    """A body that is not JSON at all. Not a validation failure: nothing validated it, so
    it names no field, and each target answers it in its own envelope."""

    def __init__(self, detail):
        super().__init__(detail)
        self.detail = detail


def parse_body(raw):
    """The request body as a value, or Malformed. Targets whose framework parses for them
    call this only on the bytes it hands back untouched."""
    try:
        return json.loads(raw)
    except (ValueError, TypeError) as e:
        raise Malformed(str(e)) from None


# ---- blend-v2 responses --------------------------------------------------------------

def payload(size):
    """Not pre-serialized. ``json.small`` against ``json.large`` is one fixture read, one
    serialize and one write at three sizes; handing back a cached string would measure none
    of it."""
    return data().payloads[size]["body"]


# ---- the etag and cache families -----------------------------------------------------
#
# No ETag value here. Each framework's own conditional machinery computes the validator
# from the body it is about to send, so it differs by target and each one declares its
# digest in /__meta. A driver reads the tag off a first response rather than looking it up.
#
# What is shared is the store's shape. The key count is derived in the fixture from the
# vary values the plan sends, because a store smaller than that evicts inside the measured
# window and the family would report eviction policy instead of the feature.

def content_etag(raw):
    """The validator a target computes for itself, where its framework computes none.

    Three of the six frameworks answer a conditional request through their own machinery
    and use their own digest; this is the one the other three hold. Spelled once so they
    cannot drift on an algorithm and have the difference read as a framework result, the
    same reason ``gzip`` above is here. sha1 over the exact response bytes, quoted and
    strong, which is what Werkzeug and the Node ecosystem both reach for.
    """
    return '"%s"' % hashlib.sha1(raw).hexdigest()


def cache_spec():
    """capacity, keys, ttl_s and the vary values, as the fixture pins them."""
    return data().cache


def vary_on(which):
    """The header names one vary row is keyed on, in the fixture's order."""
    return list(data().cache["vary"][which])


#: Pinned across every language. Compression cost is dominated by codec and level, not by
#: framework, so an unpinned level makes ``compressed.*`` a zlib benchmark.
GZIP_LEVEL = 6

CACHEABLE = "public, max-age=60"

#: Where a framework's own compressor takes a size floor, this is the one it is held to.
#: Django's gzip_page has its own at 200 and takes no setting, which changes nothing here:
#: the small payload is 125 bytes and the medium one 8131, so both floors fall between the
#: same two rows.
GZIP_MIN_SIZE = 500


def gzip(raw):
    """Compresses at the pinned level. Targets whose framework brings its own middleware
    use that instead and configure it to this level."""
    return _gzip.compress(raw, compresslevel=GZIP_LEVEL, mtime=0)


#: A counter rather than an integer because Flask serves on a thread pool: next() on this
#: is one bytecode against a C iterator, where ``n += 1`` is a read and a write with a
#: window between them.
_serial = itertools.count(1)


def next_serial():
    """``x-rb-serial``, monotonic per process. A response served from a cache anywhere in
    the path, or precomputed at boot, repeats a number it did not increment, and identical
    bytes are the whole point of the fingerprint."""
    return str(next(_serial))


def token_ok(header):
    """The denial arm's token differs only in its last character, so this compares the
    whole string rather than failing on length. Crypto is not framework cost."""
    if not header or not header.startswith("Bearer "):
        return False
    return header[7:] == data().token


def created_location():
    """The Location a created order points at. Built by concatenation rather than a format
    string: ``"/domain/orders/{}"`` is indistinguishable from a route with a capture, and
    harness/snippets.py then finds the domain routes in two places and refuses to guess."""
    return "/domain/orders/" + str(data().next_order_id)


# ---- body ----------------------------------------------------------------------------

def leaf_count(v):
    """Walks the parsed body. Without a field derived from the parsed structure a target
    can pipe request bytes straight to the response and never parse, and conformance would
    not see it: the comparison is over parsed values, so even a reordering is invisible."""
    if isinstance(v, dict):
        return sum(leaf_count(x) for x in v.values())
    if isinstance(v, list):
        return sum(leaf_count(x) for x in v)
    return 1


def bind_echo(body):
    # Compact separators and no escaping, so the count is the UTF-8 byte length that
    # JSON.stringify and serde_json::to_vec report and the field is compared against.
    n = len(json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode())
    return {"fields": leaf_count(body), "bytes": n, "echo": body}


# ---- the order body, after validation -------------------------------------------------
# Validating is the framework's own job and lives in each target: fastapi takes a Pydantic
# model, litestar a typed dataclass msgspec fills, django-asgi a django.forms.Form, and
# flask, starlette and sanic hold their own because none of the three has a validation
# layer to use. What is left here is what happens once a body is known to be good, which
# is the same work whichever framework proved it.


def price_order(customer_id, status, lines):
    """The work after the validator says yes: look each product up, carry the unit price
    onto the line, and total it. Identical in every framework, which is why it is here and
    the validating is not."""
    products = data().products_by_id
    priced, total = [], 0
    for i, line in enumerate(lines):
        pid, qty = int(line["product_id"]), int(line["qty"])
        p = products.get(pid)
        unit = p["price_cents"] if p else 0
        priced.append({"id": i + 1, "product_id": pid, "qty": qty,
                       "unit_cents": unit, "total_cents": unit * qty})
        total += unit * qty
    return {"customer_id": int(customer_id), "status": status,
            "lines": priced, "total_cents": total}



def patch_customer(cid, body):
    d = data()
    try:
        c = d.customers_by_id[int(cid)]
    except (KeyError, TypeError, ValueError):
        raise NotFound from None
    out = dict(c)
    body = body if isinstance(body, dict) else {}
    if body.get("name"):
        out["name"] = body["name"]
    if body.get("region"):
        out["region"] = body["region"]
    return out


# ---- domain --------------------------------------------------------------------------
#
# domain_filter, domain_join and domain_aggregate do the work the spec pins. Conformance
# compares values, and a precomputed page produces the same value as a computed one, so
# this is the one family where two conforming implementations can do wildly different
# amounts of work. The predicate runs over the live list on every request, the join walks
# the lines, and the aggregate folds every matching order. No index, no memoization.

def get_order(oid):
    d = data()
    try:
        return d.orders_by_id[int(oid)]
    except (KeyError, TypeError, ValueError):
        raise NotFound from None


def get_order_line(oid, lid):
    order = get_order(oid)
    try:
        n = int(lid)
    except (TypeError, ValueError):
        raise NotFound from None
    for line in order["lines"]:
        if line["id"] == n:
            return line
    raise NotFound


def domain_filter(page, size, status):
    """The page, the size and the status arrive already bound, because binding them is the
    framework's own job and lives in the target."""
    d = data()
    page = max(0, page or 0)
    size = min(100, max(1, size or 25))
    rows = [o for o in d.orders if o["status"] == status]
    start = page * size
    return {"page": page, "size": size, "total": len(rows),
            "items": rows[start:start + size]}


def domain_join(cid):
    d = data()
    try:
        customer = d.customers_by_id[int(cid)]
    except (KeyError, TypeError, ValueError):
        raise NotFound from None
    order_count = lifetime = line_count = units = 0
    recent = []
    for o in d.orders:
        if o["customer_id"] != customer["id"]:
            continue
        order_count += 1
        lifetime += o["total_cents"]
        for line in o["lines"]:
            line_count += 1
            units += line["qty"]
        recent.append({"id": o["id"], "created": o["created"],
                       "total_cents": o["total_cents"]})
    return {"customer": customer, "order_count": order_count,
            "lifetime_cents": lifetime, "line_count": line_count, "units": units,
            "recent": recent[-5:]}


def domain_aggregate(region):
    d = data()
    in_region = {c["id"] for c in d.customers if c["region"] == region}
    if not in_region:
        raise NotFound
    orders = revenue = 0
    matched = []
    for o in d.orders:
        if o["customer_id"] not in in_region:
            continue
        orders += 1
        revenue += o["total_cents"]
        matched.append(o)
    # Highest first, ties broken by the lower id, and stable so equal keys keep fixture
    # order. Every other language sorts the same way; a different tiebreak is a
    # conformance failure rather than a preference.
    matched.sort(key=lambda o: (-o["total_cents"], o["id"]))
    return {"region": region, "customers": len(in_region), "orders": orders,
            "revenue_cents": revenue,
            "top": [{"id": o["id"], "total_cents": o["total_cents"]}
                    for o in matched[:10]]}
