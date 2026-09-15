"""Turn a results JSONL into the numbers RequestBench actually publishes: ratios to the
bare baseline, never absolute latency.

  python3 harness/report.py results/<run>.jsonl [--family]
"""
import argparse, base64, json, math, pathlib, sys, collections, struct

GROWTH, NBUCKETS = 1.02, 920
LOG_G = math.log(GROWTH)
val = lambda i: math.exp((i + 0.5) * LOG_G)

def unpack(b64):
    raw = base64.b64decode(b64)
    return list(struct.unpack("<%dI" % (len(raw) // 4), raw))

def merge(hists):
    out = [0] * NBUCKETS
    for h in hists:
        for i, c in enumerate(h):
            out[i] += c
    return out

def pct(counts, p):
    total = sum(counts)
    if not total:
        return 0
    want, seen = math.ceil(p / 100 * total), 0
    for i, c in enumerate(counts):
        seen += c
        if seen >= want:
            return round(val(i))
    return round(val(NBUCKETS - 1))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--family", action="store_true", help="per-family breakdown at rung 3")
    a = ap.parse_args()

    rows = [json.loads(l) for l in pathlib.Path(a.path).read_text().splitlines() if l.strip()]
    env = next(r for r in rows if r["kind"] == "env")
    samples = [r for r in rows if r["kind"] == "sample"]
    rungs = [r for r in rows if r["kind"] == "rung"]
    baselines = env["baselines"]
    first = env["languages"][0]
    language_of = {r["target"]: r.get("language", first) for r in rungs}
    base_of = {t: baselines.get(language_of[t]) for t in language_of}
    base = baselines[first]
    targets = list(dict.fromkeys(r["target"] for r in rungs))
    missing = {b for b in base_of.values()} - set(targets)
    if missing:
        print("baseline(s) %s not in this run; ratios unavailable" % ", ".join(missing))
        return 1

    print("run      %s" % env["run_id"])
    print("host     %s  %s  %d cores" % (env["host"], env["cpu"], env["cores"]))
    print("runtime  %s   generator %s   suite %s epoch %s"
          % (env["runtime"], env["generator"], env["suite"], env["epoch"]))
    if env.get("note"):
        print("note     %s" % env["note"])

    by = {(r["target"], r["rung"]): r for r in rungs}
    rung_ids = sorted({r["rung"] for r in rungs})

    label = base if len(baselines) == 1 else "each language's own baseline"
    print("\nachieved rps / p50 us / p99 us   (x = ratio to %s, lower is better)" % label)
    head = "  %-12s" % "target"
    for rn in rung_ids:
        any_row = next(r for r in rungs if r["rung"] == rn)
        head += " %-26s" % ("rung %d @ %s rps" % (rn, any_row["offered_rps"]))
    print(head)
    for t in targets:
        tag = t if len(baselines) == 1 else "%s:%s" % (language_of.get(t, "?"), t)
        line = "  %-16s" % tag
        tb = base_of.get(t, base)
        for rn in rung_ids:
            r, b = by.get((t, rn)), by.get((tb, rn))
            if not r or not b:
                line += " %-26s" % "-"; continue
            rat = r["p50_us"] / b["p50_us"] if b["p50_us"] else 0
            cell = "%5d %5d %6d %5.2fx" % (r["achieved_rps"], r["p50_us"], r["p99_us"], rat)
            line += " %-26s" % cell
        print(line)

    bad = [(r["target"], r["rung"], r["errors"], r["status_mismatch"], r["dropped"])
           for r in rungs if r["errors"] or r["status_mismatch"] or r["dropped"]]
    if bad:
        print("\n  integrity:")
        for t, rn, e, m, d in bad:
            print("    %-12s rung %d  errors %d  status_mismatch %d  dropped %d" % (t, rn, e, m, d))
    else:
        print("\n  integrity: no errors, no status mismatches, no drops")

    if a.family:
        mid = rung_ids[len(rung_ids) // 2]
        print("\nper-family p50 at rung %d, as a ratio to %s" % (mid, base))
        fams = list(dict.fromkeys(s["family"] for s in samples))
        print("  %-16s %10s" % ("family", base) + "".join(
            " %12s" % t for t in targets if t != base))
        basefam = {}
        for f in fams:
            hs = [unpack(s["hist_b64"]) for s in samples
                  if s["target"] == base and s["rung"] == mid and s["family"] == f]
            basefam[f] = pct(merge(hs), 50) if hs else 0
        for f in fams:
            line = "  %-16s %10d" % (f, basefam[f])
            for t in targets:
                if t == base:
                    continue
                hs = [unpack(s["hist_b64"]) for s in samples
                      if s["target"] == t and s["rung"] == mid and s["family"] == f]
                p = pct(merge(hs), 50) if hs else 0
                line += " %11.2fx" % (p / basefam[f] if basefam[f] else 0)
            print(line)
    return 0

if __name__ == "__main__":
    sys.exit(main())
