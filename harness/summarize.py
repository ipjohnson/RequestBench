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
    base = env["baseline"]
    targets = list(dict.fromkeys(r["target"] for r in rungs))
    by = {(r["target"], r["rung"]): r for r in rungs}
    rung_ids = sorted({r["rung"] for r in rungs})

    # family p50 per (target, rung), merged from the per-endpoint histograms
    fam = collections.defaultdict(lambda: collections.defaultdict(list))
    for s in samples:
        fam[(s["target"], s["rung"])][s["family"]].append(s["hist_b64"])
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
        "baseline": base, "rungs": rung_ids, "targets": [],
    }
    for t in targets:
        m = meta.get(t, {})
        entry = {"target": t, "framework": m.get("framework", t),
                 "version": m.get("version", ""), "target_runtime": m.get("runtime", ""),
                 "rungs": {}, "families": {}}
        for rn in rung_ids:
            r, b = by.get((t, rn)), by.get((base, rn))
            if not r:
                continue
            entry["rungs"][str(rn)] = {
                "offered_rps": r["offered_rps"], "achieved_rps": r["achieved_rps"],
                "p50_us": r["p50_us"], "p99_us": r["p99_us"], "p999_us": r["p999_us"],
                "dropped": r["dropped"], "errors": r["errors"],
                "status_mismatch": r["status_mismatch"],
                "p50_ratio": ratio(r["p50_us"], b["p50_us"]) if b else None,
                "p99_ratio": ratio(r["p99_us"], b["p99_us"]) if b else None,
            }
        mid = rung_ids[len(rung_ids) // 2]
        for f, v in sorted(fam_p50.get((t, mid), {}).items()):
            bv = fam_p50.get((base, mid), {}).get(f)
            entry["families"][f] = {"p50_us": v, "p50_ratio": ratio(v, bv) if bv else None}
        out["targets"].append(entry)

    blob = json.dumps(out, indent=2, sort_keys=True)
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
