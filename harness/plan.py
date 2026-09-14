"""Expand the endpoint spec into spec/plan.json: concrete, pre-resolved requests.

Every driver replays this file rather than filling templates itself. That keeps the
conformance checker and the load generator sending byte-identical shapes, keeps string
formatting out of the generator's hot loop, and makes correlated ids (an order and the
customer who actually owns it) a build-time concern instead of a runtime one.

Request headers are resolved here too, for the same reason paths are. Four families are
defined by what the request carries rather than by where it points: the bearer token, the
Accept-Encoding, the If-None-Match and the twenty-seven extra headers all have to be the
same bytes for every target, and two of them are values only the fixture knows.
"""
import json, random, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = json.loads((ROOT / "spec" / "endpoints.json").read_text())
FIX = json.loads((ROOT / "spec" / "fixture.json").read_text())
# Sixty-four made the whole endpoint set memoizable: a target could precompute every
# response at boot and reduce each endpoint to a dispatch and a write, and conformance
# could not see it, because identical bytes are the point of the fingerprint. Five hundred
# and twelve makes that impractical rather than merely forbidden.
INSTANCES = 512
SEED = 424242

ORDERS = FIX["orders"]

# Line counts are chosen so the serialized body lands in the same size regime as the
# response payload of the same name. Asserted in build(), because "medium" meaning two
# different things in two places is exactly the drift this file exists to prevent.
LINES_SMALL, LINES_MEDIUM = 1, 336

def order(nlines):
    return {"customer_id": 1, "status": "open",
            "lines": [{"product_id": 1 + (i % 50), "qty": 1 + (i % 5)} for i in range(nlines)]}

BODIES = {
    "order_small":    order(LINES_SMALL),
    "order_medium":   order(LINES_MEDIUM),
    # Fails on its first field, so the gap between collect-all and first-error is wide
    # enough to read. Every later field is invalid too, which is what the two contracts
    # disagree about.
    "order_invalid":  {"customer_id": "not-an-int", "status": 42, "lines": "nope"},
    "customer_patch": {"name": "Ada L.", "region": "south"},
    # Not JSON at all. This is the parser's failure path, not the validator's, which is
    # what separates errors.malformed from body.rejected_all.
    "malformed":      "{\"customer_id\": 1, \"lines\": [",
}

def free_params(rng):
    fx, out = SPEC["fixture"], {}
    for name, rule in SPEC["params"].items():
        if rule["kind"] == "int_range":
            r = fx[rule["from"].split(".")[1]] if "from" in rule else rule
            out[name] = rng.randint(r["min"], r["max"])
        else:
            vals = fx[rule["from"].split(".")[1]] if "from" in rule else rule["values"]
            out[name] = rng.choice(vals)
    return out

def correlate(strategy, params, rng):
    """Overwrite free params so related ids refer to the same real objects. Without this,
    domain.delete would name a line that its order does not have and measure the 404 path
    on most instances."""
    if strategy == "order_line":
        o = rng.choice(ORDERS)
        params["order"] = o["id"]
        params["line"] = rng.choice(o["lines"])["id"]
    return params

def fixture_value(dotted):
    """Resolve {auth.token} or {payloads.large.etag} against the committed fixture."""
    node = FIX
    for part in dotted.split("."):
        node = node[part]
    return str(node)


def header_set(name):
    raw = SPEC["header_sets"][name]
    return {k: re.sub(r"\{([a-z_.]+)\}", lambda m: fixture_value(m.group(1)), v)
            for k, v in raw.items()}


def build():
    rng = random.Random(SEED)
    small = json.dumps(BODIES["order_small"], separators=(",", ":"))
    medium = json.dumps(BODIES["order_medium"], separators=(",", ":"))
    assert len(small) < 256, "order_small is %d bytes" % len(small)
    assert 4096 < len(medium) < 16384, \
        "order_medium is %d bytes, which is not the medium regime" % len(medium)
    plan = {"version": SPEC["version"], "sampling": SPEC["sampling"],
            "instances": INSTANCES, "endpoints": []}
    for ep in SPEC["endpoints"]:
        rows = []
        for _ in range(INSTANCES):
            params = free_params(rng)
            if "correlate" in ep:
                params = correlate(ep["correlate"], params, rng)
            path = ep["path"]
            for k, v in params.items():
                path = path.replace("{%s}" % k, str(v))
            assert "{" not in path, "unfilled placeholder in %s: %s" % (ep["id"], path)
            rows.append(path)
        entry = {"id": ep["id"], "family": ep["family"], "method": ep["method"],
                 "expect": ep["expect"], "paths": rows}
        for key in ("base", "varies", "payload"):
            if key in ep:
                entry[key] = ep[key]
        if "headers" in ep:
            entry["headers"] = header_set(ep["headers"])
        if "body" in ep:
            b = BODIES[ep["body"]]
            # A malformed body is raw bytes on purpose; serializing it would repair it.
            entry["body"] = b if isinstance(b, str) else json.dumps(b, separators=(",", ":"))
        plan["endpoints"].append(entry)
    return plan

def check_references(plan):
    """Every base and every weighted id has to name an endpoint that exists.

    A weight vector is the only place a traffic opinion lives, and a renamed endpoint
    turns one of its entries into a no-op rather than an error: the blend quietly starts
    counting a row it was written to leave out, and the number still looks fine.
    """
    ids = {e["id"] for e in plan["endpoints"]}
    bad = []
    for e in plan["endpoints"]:
        if "base" in e and e["base"] not in ids:
            bad.append("%s names base %s, which is not an endpoint" % (e["id"], e["base"]))
    blends = json.loads((ROOT / "spec" / "blends.json").read_text())
    for name, blend in blends["blends"].items():
        for eid in blend["weights"]:
            if eid not in ids:
                bad.append("blend %s weights %s, which is not an endpoint" % (name, eid))
    return bad


if __name__ == "__main__":
    plan = build()
    problems = check_references(plan)
    if problems:
        for line in problems:
            print("  %s" % line)
        raise SystemExit("spec/endpoints.json and spec/blends.json disagree")
    out = ROOT / "spec" / "plan.json"
    out.write_text(json.dumps(plan, separators=(",", ":")))
    uniq = sum(len(set(e["paths"])) for e in plan["endpoints"])
    print("wrote %s  (%.0f KB)" % (out, out.stat().st_size / 1024))
    print("  %d endpoints x %d instances, %d distinct paths"
          % (len(plan["endpoints"]), INSTANCES, uniq))
    bodies = sum(1 for e in plan["endpoints"] if "body" in e)
    hdrs = sum(1 for e in plan["endpoints"] if "headers" in e)
    pairs = sum(1 for e in plan["endpoints"] if "base" in e)
    print("  %d carry a request body, %d carry request headers, %d name a base"
          % (bodies, hdrs, pairs))
    print("  sampling is %s: every endpoint is drawn with equal probability"
          % plan["sampling"])
