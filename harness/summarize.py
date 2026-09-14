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
                 "baseline": base_of.get(t, env["baseline"]),
                 "framework": m.get("framework", t),
                 "version": m.get("version", ""), "target_runtime": m.get("runtime", ""),
                 "rungs": {}, "families": {}}
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
        # Per endpoint, per rung, as arrays parallel to endpoint_order.
        eps = {"p50_us": {}, "p99_us": {}, "count": {}, "p50_ratio": {}}
        for rn in rung_ids:
            p50s, p99s, counts, ratios = [], [], [], []
            for eid in ep_order:
                row = ep_hist.get((t, rn, eid))
                brow = ep_hist.get((base, rn, eid))
                p50s.append(row["p50_us"] if row else None)
                p99s.append(row["p99_us"] if row else None)
                counts.append(row["count"] if row else 0)
                ratios.append(ratio(row["p50_us"], brow["p50_us"])
                              if row and brow and brow["p50_us"] else None)
            eps["p50_us"][str(rn)] = p50s
            eps["p99_us"][str(rn)] = p99s
            eps["count"][str(rn)] = counts
            eps["p50_ratio"][str(rn)] = ratios
        entry["endpoints"] = eps

        mid = rung_ids[len(rung_ids) // 2]
        for f, v in sorted(fam_p50.get((t, mid), {}).items()):
            bv = fam_p50.get((base, mid), {}).get(f)
            entry["families"][f] = {"p50_us": v, "p50_ratio": ratio(v, bv) if bv else None}
        out["targets"].append(entry)

    # Compact, not pretty. Indenting puts every one of the per-endpoint integers on its
    # own line and quadruples a file that is committed on every run and kept forever.
    # `jq .` reads it fine.
    blob = json.dumps(out, separators=(",", ":"), sort_keys=True)
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
