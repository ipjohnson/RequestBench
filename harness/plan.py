"""Expand the endpoint spec into spec/plan.json: concrete, pre-resolved requests.

Every driver replays this file rather than filling templates itself. That keeps the
conformance checker and the load generator sending byte-identical shapes, keeps string
formatting out of the generator's hot loop, and makes correlated ids (an order and the
customer who actually owns it) a build-time concern instead of a runtime one.
"""
import json, random, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = json.loads((ROOT / "spec" / "endpoints.json").read_text())
FIX = json.loads((ROOT / "spec" / "fixture.json").read_text())
INSTANCES = 64
SEED = 424242

ORDERS = FIX["orders"]
CUSTOMERS = {c["id"]: c for c in FIX["customers"]}

BODIES = {
    "order_draft":    {"customer_id": 1, "status": "open",
                       "lines": [{"product_id": 3, "qty": 2}, {"product_id": 7, "qty": 1}]},
    "order_invalid":  {"customer_id": "not-an-int", "lines": []},
    "customer_draft": {"name": "Ada Lovelace", "email": "ADA@example.invalid", "region": "north"},
    "customer_patch": {"name": "Ada L.", "region": "south"},
    "product_draft":  {"name": "brass-ring-99", "category": "tools", "price_cents": 1299},
    "line_draft":     {"product_id": 5, "qty": 3},
    "malformed":      {"customer_id": None, "status": 42, "lines": "nope"},
    "echo_400b":      {"pad": "x" * 360, "n": 1},
    "echo_32kb":      {"pad": "x" * 32_200, "n": 2},
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
    """Overwrite free params so related ids refer to the same real objects."""
    if strategy in ("order_chain", "order_line"):
        o = rng.choice(ORDERS)
        params["order"] = o["id"]
        params["line"] = rng.choice(o["lines"])["id"]
        if strategy == "order_chain":
            c = CUSTOMERS[o["customer_id"]]
            params["customer"] = c["id"]
            params["region"] = c["region"]
    elif strategy == "customer_any":
        params["customer"] = rng.choice(list(CUSTOMERS))
    return params

def build():
    rng = random.Random(SEED)
    plan = {"version": SPEC["version"], "instances": INSTANCES, "endpoints": []}
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
                 "share": ep["share"], "expect": ep["expect"], "paths": rows}
        if "body" in ep:
            entry["body"] = json.dumps(BODIES[ep["body"]], separators=(",", ":"))
        plan["endpoints"].append(entry)
    return plan

if __name__ == "__main__":
    plan = build()
    out = ROOT / "spec" / "plan.json"
    out.write_text(json.dumps(plan, separators=(",", ":")))
    uniq = sum(len(set(e["paths"])) for e in plan["endpoints"])
    print("wrote %s  (%.0f KB)" % (out, out.stat().st_size / 1024))
    print("  %d endpoints x %d instances, %d distinct paths"
          % (len(plan["endpoints"]), INSTANCES, uniq))
    bodies = sum(1 for e in plan["endpoints"] if "body" in e)
    print("  %d endpoints carry a request body" % bodies)
