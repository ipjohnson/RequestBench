"""Deterministic fixture shared by every target. Regenerate with `make fixture`.

The file is committed because identical data across 43 targets in six languages is a
correctness requirement, and re-deriving it per language invites drift.
"""
import json, random, pathlib

SEED = 20260913
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
            "customers": customers, "orders": orders}

if __name__ == "__main__":
    out = pathlib.Path(__file__).resolve().parent.parent / "spec" / "fixture.json"
    data = build()
    out.write_text(json.dumps(data, separators=(",", ":"), sort_keys=True))
    print("wrote %s  (%.1f KB)" % (out, out.stat().st_size / 1024))
    print("  products %d  customers %d  orders %d  lines %d"
          % (len(data["products"]), len(data["customers"]), len(data["orders"]),
             sum(len(o["lines"]) for o in data["orders"])))
