"""Deterministic fixture shared by every target. Regenerate with `make fixture`.

The file is committed because identical data across 43 targets in six languages is a
correctness requirement, and re-deriving it per language invites drift.
"""
import hashlib, json, random, pathlib

SEED = 20260913
# The response payloads draw from their own generator. Sharing SEED's stream would move
# every product, customer and order the moment a payload changed, and with them every
# fingerprint the existing targets already match.
PAYLOAD_SEED = 20260914
# Record counts, not byte counts, are the pinned quantity. The byte counts they produce
# are asserted below so a change to the generator cannot silently move a size regime.
PAYLOAD_RECORDS = {"small": 1, "medium": 89, "large": 1425}
PAYLOAD_BYTES = {"small": 125, "medium": 8131, "large": 131360}
ADJ = ["brass", "copper", "oak", "steel", "linen", "cedar", "slate", "amber"]
NOUN = ["ring", "bolt", "seed", "pan", "desk", "hinge", "trowel", "lamp"]
FIRST = ["ada", "linus", "grace", "alan", "edsger", "barbara", "ken", "margaret"]
LAST = ["hopper", "lovelace", "dijkstra", "liskov", "torvalds", "thompson", "hamilton"]
REGIONS = ["north", "south", "east", "west"]
CATEGORIES = ["tools", "garden", "kitchen", "outdoor", "office"]
STATUSES = ["open", "paid", "shipped", "cancelled"]

def build():
    r = random.Random(SEED)
    products = [{
        "id": i, "name": f"{r.choice(ADJ)}-{r.choice(NOUN)}-{i}",
        "category": CATEGORIES[i % len(CATEGORIES)],
        "price_cents": r.randrange(199, 19999),
        "in_stock": r.random() > 0.15,
    } for i in range(1, 51)]

    reviews = {p["id"]: [{
        "id": j, "product_id": p["id"], "stars": r.randrange(1, 6),
        "body": f"{r.choice(ADJ)} {r.choice(NOUN)}, would buy again",
    } for j in range(1, r.randrange(2, 8))] for p in products}

    customers = [{
        "id": i, "name": f"{r.choice(FIRST)} {r.choice(LAST)}",
        "email": f"user{i}@example.invalid",
        "region": REGIONS[i % len(REGIONS)],
        "created": f"2025-{1 + i % 12:02d}-{1 + i % 28:02d}",
    } for i in range(1, 201)]

    orders = []
    for i in range(1, 1001):
        n = r.randrange(1, 11)
        lines = []
        for j in range(1, n + 1):
            p = products[r.randrange(0, 50)]
            qty = r.randrange(1, 6)
            lines.append({"id": j, "product_id": p["id"], "qty": qty,
                          "unit_cents": p["price_cents"], "total_cents": qty * p["price_cents"]})
        orders.append({
            "id": i, "customer_id": 1 + (i * 7) % 200,
            "status": STATUSES[i % len(STATUSES)],
            "created": f"2026-{1 + i % 9:02d}-{1 + i % 28:02d}",
            "total_cents": sum(l["total_cents"] for l in lines),
            "lines": lines,
        })
    return {"seed": SEED, "products": products, "reviews": reviews,
            "customers": customers, "orders": orders,
            "payloads": payloads(), "auth": auth(),
            "validators": validators(), "cache": cache()}


# ---- response payloads ----------------------------------------------------------------
# Three sizes of one shape, so size is the only thing that varies between them. Records are
# distinct rather than the fifty fixture products cycled: cycling compresses 26:1 and would
# make `compressed.*` measure a codec running on unrealistic input.

def emit(obj):
    """The pinned serialization. Keys ascend, no spaces. Every target must emit exactly
    these bytes, which is what makes the payload the controlled variable every feature
    family subtracts against.
    Alphabetical order is chosen so `sort_keys=True` in this file already is that order:
    a JS target reproduces it by parse-then-stringify, and a struct-based target
    reproduces it by declaring its fields in the same order."""
    return json.dumps(obj, separators=(",", ":"), sort_keys=True)


def payloads():
    out = {}
    for name, n in PAYLOAD_RECORDS.items():
        r = random.Random(PAYLOAD_SEED)
        items = [{
            "id": i + 1,
            "name": f"{r.choice(ADJ)}-{r.choice(NOUN)}-{r.randrange(1000, 9999)}",
            "category": CATEGORIES[i % len(CATEGORIES)],
            "price_cents": r.randrange(199, 19999),
            "in_stock": r.random() > 0.15,
        } for i in range(n)]
        body = {"size": name, "count": n, "items": items}
        wire = emit(body)
        assert len(wire) == PAYLOAD_BYTES[name], (
            "%s payload is %d bytes, spec says %d" % (name, len(wire), PAYLOAD_BYTES[name]))
        out[name] = {
            "body": body,
            "bytes": len(wire),
            "html": render(body),
        }
    return out


# ---- the etag and cache families -------------------------------------------------------
# The ETag itself is no longer here. Each framework's own conditional machinery computes
# the validator, so the value differs by target and a driver reads it off a first response
# instead of looking it up; see 'two_phase_capture' in spec/endpoints.json. What is still
# pinned is the tag that must never match, because a stale arm needs a syntactically valid
# validator that no digest can produce, and that one is the same sixteen zeros everywhere.

STALE_ETAG = '"%s"' % ("0" * 16)

# The values the vary rows send. Pinned rather than drawn, because the count of distinct
# keys they produce is what every target sizes its response cache against: a store smaller
# than this evicts inside the measured window and the family reports eviction policy.
#
# The names are this repository's own rather than a realistic Accept-Language, because a
# header a framework treats specially makes the row measure that treatment instead of the
# key. Django is the one that showed it: cache_page drops Accept-Language from the key
# whenever USE_I18N is on, on the grounds that the locale suffix already covers it, so a
# vary row keyed on it answered one stored response for every value sent.
VARY = {
    "one": {"x-rb-tenant": ["alpha", "beta"]},
    "many": {"x-rb-tenant": ["alpha", "beta"],
             "x-rb-channel": ["web", "app"],
             "x-rb-region": ["eu", "us"]},
}
# Three rows keyed by path alone, then one key per combination on each vary row.
PATH_KEYS = 3
# Well past the roughly 600s a target is up for under ladder-v2: 90s of warmup, two 240s
# rungs and the settles between them. An expiry inside the run puts re-misses in the
# measured window, which is the likelier footgun of the two.
TTL_S = 3600


def combinations(axes):
    n = 1
    for values in axes.values():
        n *= len(values)
    return n


def cache():
    keys = PATH_KEYS + sum(combinations(a) for a in VARY.values())
    assert keys == 13, "the vary set produces %d distinct keys, spec says 13" % keys
    # Room above the key count rather than a fit: a cap equal to it evicts on the first
    # collision a store resolves in its own order, and which key is lost would then be an
    # implementation detail deciding a measurement.
    capacity = 20
    assert capacity > keys, "capacity %d does not hold %d keys" % (capacity, keys)
    return {"capacity": capacity, "keys": keys, "ttl_s": TTL_S, "vary": VARY}


def validators():
    return {"stale": STALE_ETAG}


def render(body):
    """The expected template output. One row per record, no whitespace between elements.
    the client collapses whitespace before comparing text/html, so an engine may format as
    it likes; the elements, their order and their values are what is pinned."""
    rows = "".join(
        "<tr><td>%d</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td></tr>"
        % (i["id"], i["name"], i["category"], i["price_cents"],
           "yes" if i["in_stock"] else "no")
        for i in body["items"])
    return ("<!doctype html><html><head><title>items</title></head><body>"
            "<h1>%s</h1><table><thead><tr><th>id</th><th>name</th><th>category</th>"
            "<th>price</th><th>stock</th></tr></thead><tbody>%s</tbody></table>"
            "<p>%d rows</p></body></html>" % (body["size"], rows, body["count"]))


def auth():
    """One opaque bearer token, and a wrong one of equal length differing in the last
    character. Equal length makes the comparison walk the whole string instead of failing
    on a length check, which is the cost `authorized.denied` is there to measure. No
    crypto: signature verification is pinned per language in Suite B, not here."""
    good = hashlib.sha256(b"requestbench/blend-v2/token").hexdigest()[:32]
    bad = good[:-1] + ("0" if good[-1] != "0" else "1")
    return {"token": good, "wrong_token": bad}

if __name__ == "__main__":
    out = pathlib.Path(__file__).resolve().parent.parent / "spec" / "fixture.json"
    data = build()
    out.write_text(json.dumps(data, separators=(",", ":"), sort_keys=True))
    print("wrote %s  (%.1f KB)" % (out, out.stat().st_size / 1024))
    print("  products %d  customers %d  orders %d  lines %d"
          % (len(data["products"]), len(data["customers"]), len(data["orders"]),
             sum(len(o["lines"]) for o in data["orders"])))
    print("  response cache: %d distinct keys, capacity %d, ttl %ds"
          % (data["cache"]["keys"], data["cache"]["capacity"], data["cache"]["ttl_s"]))
