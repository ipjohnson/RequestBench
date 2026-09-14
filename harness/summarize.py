"""Collapse a run's JSONL into the small record that gets committed and kept forever.

The raw JSONL carries a histogram per endpoint per rung and runs to megabytes; it lives in
a build artifact. This is the durable time series regression detection reads, so it holds
ratios rather than absolutes and stays a few kilobytes.

  python3 harness/summarize.py results/<run>.jsonl --out results/summary/<run>.json
"""
import argparse, base64, json, math, pathlib, struct, sys, collections

GROWTH, NBUCKETS = 1.02, 920
LOG_G = math.log(GROWTH)

def unpack(b64):
    raw = base64.b64decode(b64)
    return struct.unpack("<%dI" % (len(raw) // 4), raw)

def pct(counts, p):
    total = sum(counts)
    if not total:
        return 0
    want, seen = math.ceil(p / 100 * total), 0
    for i, c in enumerate(counts):
        seen += c
        if seen >= want:
            return round(math.exp((i + 0.5) * LOG_G))
    return 0

def ratio(v, base):
    return round(v / base, 4) if base else None


# Past this fraction of dropped requests the baseline itself is past its knee, and a ratio
# to it compares two saturated systems rather than measuring framework overhead.
SATURATION = 0.01


def saturated(rung_row):
    offered = rung_row["offered_rps"] * rung_row["seconds"]
    return offered > 0 and rung_row["dropped"] / offered > SATURATION

def readable(obj, indent=0):
    """Indented structure, but leaf arrays stay on one line.

    Plain json.dumps(indent=2) puts every one of the forty per-endpoint integers on its
    own line, which quadruples the file and makes it unreadable in a browser anyway. This
    keeps the shape legible on github.com while leaving the numeric arrays compact.
    """
    pad, inner = "  " * indent, "  " * (indent + 1)
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        items = ['%s%s: %s' % (inner, json.dumps(k), readable(v, indent + 1))
                 for k, v in sorted(obj.items())]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(obj, list):
        if not obj:
            return "[]"
        if all(not isinstance(x, (dict, list)) for x in obj):
            return json.dumps(obj, separators=(",", ":"))   # a leaf array stays on one line
        items = [inner + readable(v, indent + 1) for v in obj]
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    return json.dumps(obj)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--out")
    ap.add_argument("--runner", default="unknown")
    ap.add_argument("--tracked", action="store_true",
                    help="this run enters the regression time series")
    a = ap.parse_args()

    rows = [json.loads(l) for l in pathlib.Path(a.path).read_text().splitlines() if l.strip()]
    env = next(r for r in rows if r["kind"] == "env")
    rungs = [r for r in rows if r["kind"] == "rung"]
    meta = {r["target"]: r for r in rows if r["kind"] == "target"}
    samples = [r for r in rows if r["kind"] == "sample"]
    # A cross-language run has one baseline per language. Ratios are always within a
    # language; the absolutes are what carry across, because nothing moved between targets.
    baselines = env.get("baselines") or {env["shard"]: env["baseline"]}
    shard_of = {r["target"]: r.get("shard", env["shard"]) for r in rungs}
    base_of = {t: baselines.get(shard_of[t], env["baseline"]) for t in shard_of}
    targets = list(dict.fromkeys(r["target"] for r in rungs))
    by = {(r["target"], r["rung"]): r for r in rungs}
    rung_ids = sorted({r["rung"] for r in rungs})

    # Everything rolls up from one place: the per-endpoint histograms. An endpoint is a
    # histogram, a family is its endpoints merged, the blend is every family merged. Keep
    # all three levels so the site can drill down without a second pass over the raw file.
    ep_order, ep_family, seen = [], {}, set()
    for row in samples:
        if row["endpoint"] not in seen:
            seen.add(row["endpoint"])
            ep_order.append(row["endpoint"])
            ep_family[row["endpoint"]] = row["family"]

    ep_hist = {(row["target"], row["rung"], row["endpoint"]): row for row in samples}
    fam = collections.defaultdict(lambda: collections.defaultdict(list))
    for row in samples:
        fam[(row["target"], row["rung"])][row["family"]].append(row["hist_b64"])
    fam_p50 = {}
    for key, byfam in fam.items():
        fam_p50[key] = {}
        for f, hs in byfam.items():
            merged = [0] * NBUCKETS
            for h in hs:
                for i, c in enumerate(unpack(h)):
                    merged[i] += c
            fam_p50[key][f] = pct(merged, 50)

    out = {
        "run_id": env["run_id"], "date": env["run_id"][:10], "shard": env["shard"],
        "suite": env["suite"], "epoch": env["epoch"], "mode": env.get("mode", "local"),
        "runner": a.runner, "tracked": a.tracked,
        "exec_host": env.get("exec_host") or "container",
        "host": env["host"], "cpu": env["cpu"], "cores": env["cores"],
        "sut_cpus": env.get("sut_cpus", ""), "gen_cpus": env.get("gen_cpus", ""),
        "runtime": env["runtime"], "generator": env["generator"],
        "baseline": env["baseline"], "baselines": baselines,
        "shards": env.get("shards", [env["shard"]]),
        "cross_language": env.get("cross_language", False),
        "rungs": rung_ids, "targets": [],
        # Declared once. Per-target endpoint arrays are parallel to this, which keeps the
        # file small enough to commit on every run and keep forever.
        "endpoint_order": ep_order,
        "endpoint_family": [ep_family[e] for e in ep_order],
    }
    for t in targets:
        m = meta.get(t, {})
        entry = {"target": t, "shard": shard_of.get(t, env["shard"]),
                 "exec_host": meta.get(t, {}).get("host", env.get("host", "container")),
                 "baseline": base_of.get(t, env["baseline"]),
                 "framework": m.get("framework", t),
                 "version": m.get("version", ""), "target_runtime": m.get("runtime", ""),
                 "rungs": {}, "families": {}, "families_by_rung": {}}
        base = base_of.get(t, env["baseline"])
        for rn in rung_ids:
            r, b = by.get((t, rn)), by.get((base, rn))
            if not r:
                continue
            base_sat = saturated(b) if b else False
            entry["rungs"][str(rn)] = {
                "baseline_saturated": base_sat,
                "saturated": saturated(r),
                "offered_rps": r["offered_rps"], "achieved_rps": r["achieved_rps"],
                "p50_us": r["p50_us"], "p99_us": r["p99_us"], "p999_us": r["p999_us"],
                "dropped": r["dropped"], "errors": r["errors"],
                "status_mismatch": r["status_mismatch"],
                "p50_ratio": ratio(r["p50_us"], b["p50_us"]) if b else None,
                "p99_ratio": ratio(r["p99_us"], b["p99_us"]) if b else None,
            }
        # Per endpoint, per rung, every statistic the histogram can answer. Arrays are
        # parallel to endpoint_order. Nothing is dropped for size: the repository is
        # public, so neither Actions minutes nor storage is billed, and a percentile
        # discarded here is one the 90-day artifact retention eventually takes with it.
        fields = ("count", "errors", "mismatch", "p50_us", "p90_us", "p99_us", "p999_us",
                  "p50_ratio", "p99_ratio")
        eps = {f: {} for f in fields}
        for rn in rung_ids:
            acc = {f: [] for f in fields}
            for eid in ep_order:
                row = ep_hist.get((t, rn, eid))
                brow = ep_hist.get((base, rn, eid))
                if not row:
                    for f in fields:
                        acc[f].append(None)
                    continue
                h = unpack(row["hist_b64"])
                bh = unpack(brow["hist_b64"]) if brow else None
                p50, p90 = pct(h, 50), pct(h, 90)
                p99, p999 = pct(h, 99), pct(h, 99.9)
                acc["count"].append(row["count"])
                acc["errors"].append(row.get("errors", 0))
                acc["mismatch"].append(row.get("mismatch", 0))
                acc["p50_us"].append(p50)
                acc["p90_us"].append(p90)
                acc["p99_us"].append(p99)
                acc["p999_us"].append(p999)
                acc["p50_ratio"].append(ratio(p50, pct(bh, 50)) if bh else None)
                acc["p99_ratio"].append(ratio(p99, pct(bh, 99)) if bh else None)
            for f in fields:
                eps[f][str(rn)] = acc[f]
        entry["endpoints"] = eps

        mid = rung_ids[len(rung_ids) // 2]
        # Families at every rung too, not just the middle one, with the same percentiles.
        for rn in rung_ids:
            for f, hs in fam.get((t, rn), {}).items():
                merged = [0] * NBUCKETS
                for h in hs:
                    for i, c in enumerate(unpack(h)):
                        merged[i] += c
                bmerged = [0] * NBUCKETS
                for h in fam.get((base, rn), {}).get(f, []):
                    for i, c in enumerate(unpack(h)):
                        bmerged[i] += c
                rec = {"p50_us": pct(merged, 50), "p90_us": pct(merged, 90),
                       "p99_us": pct(merged, 99), "p999_us": pct(merged, 99.9),
                       "count": sum(merged)}
                if any(bmerged):
                    rec["p50_ratio"] = ratio(rec["p50_us"], pct(bmerged, 50))
                    rec["p99_ratio"] = ratio(rec["p99_us"], pct(bmerged, 99))
                entry["families_by_rung"].setdefault(str(rn), {})[f] = rec
            if rn == mid:
                # `families` stays flat and keyed by family name, which is what the site
                # reads; the rung-keyed copy lives beside it rather than inside it.
                entry["families"] = dict(entry["families_by_rung"].get(str(rn), {}))
        out["targets"].append(entry)

    blob = readable(out)
    if a.out:
        p = pathlib.Path(a.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(blob)
        print("wrote %s  (%.1f KB)" % (p, len(blob) / 1024))
    else:
        print(blob)
    return 0

if __name__ == "__main__":
    sys.exit(main())
