"""Turn a results JSONL into the numbers RequestBench publishes: what each target
achieved and how long it took, at every rate in the run.

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
    ap.add_argument("--family", action="store_true", help="per-family breakdown at the higher rate")
    a = ap.parse_args()

    rows = [json.loads(l) for l in pathlib.Path(a.path).read_text().splitlines() if l.strip()]
    env = next(r for r in rows if r["kind"] == "env")
    samples = [r for r in rows if r["kind"] == "sample"]
    rungs = [r for r in rows if r["kind"] == "rung"]
    first = env["languages"][0]
    language_of = {r["target"]: r.get("language", first) for r in rungs}
    targets = list(dict.fromkeys(r["target"] for r in rungs))

    print("run      %s" % env["run_id"])
    print("host     %s  %s  %d cores" % (env["host"], env["cpu"], env["cores"]))
    print("runtime  %s   generator %s   suite %s epoch %s"
          % (env["runtime"], env["generator"], env["suite"], env["epoch"]))
    if env.get("note"):
        print("note     %s" % env["note"])

    by = {(r["target"], r["rung"]): r for r in rungs}
    rung_ids = sorted({r["rung"] for r in rungs})

    print("\nachieved rps / p50 us / p99 us   (lower is better)")
    head = "  %-16s" % "target"
    for rn in rung_ids:
        any_row = next(r for r in rungs if r["rung"] == rn)
        head += " %-24s" % ("%s @ %s rps" % (any_row.get("rate", "rung %d" % rn),
                                             any_row["offered_rps"]))
    print(head)
    for t in targets:
        tag = t if len(set(language_of.values())) == 1 else "%s:%s" % (language_of.get(t, "?"), t)
        line = "  %-16s" % tag
        for rn in rung_ids:
            r = by.get((t, rn))
            if not r:
                line += " %-24s" % "-"; continue
            # A rate the target did not complete has no latency to print: the percentiles
            # would describe only the requests that survived. What it managed and what it
            # lost is the whole of what happened there.
            if not r.get("completed", True) or r["p50_us"] is None:
                offered = r["offered_rps"] * r["seconds"]
                line += " %-24s" % ("%6d  dropped %4.1f%%"
                                    % (r["achieved_rps"],
                                       100 * r["dropped"] / offered if offered else 0))
                continue
            line += " %-24s" % ("%6d %6d %7d"
                                % (r["achieved_rps"], r["p50_us"], r["p99_us"]))
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
        # The first rate: the one every target is expected to complete, so the table has
        # a column for each of them rather than a dash where the raised rate was dropped.
        mid = rung_ids[0]
        rate = next((r.get("rate") for r in rungs if r["rung"] == mid), "rung %d" % mid)
        print("\nper-family p50 us at the %s rate" % rate)
        fams = list(dict.fromkeys(s["family"] for s in samples))
        print("  %-16s" % "family" + "".join(" %12s" % t for t in targets))
        for f in fams:
            line = "  %-16s" % f
            for t in targets:
                hs = [unpack(s["hist_b64"]) for s in samples
                      if s["target"] == t and s["rung"] == mid and s["family"] == f]
                line += " %12s" % (pct(merge(hs), 50) if hs else "-")
            print(line)
    return 0

if __name__ == "__main__":
    sys.exit(main())
