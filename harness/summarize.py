"""Collapse a run's JSONL into the small record that gets committed and kept forever.

The raw JSONL carries a histogram per endpoint per rung and runs to megabytes; it lives in
a build artifact. This is the durable time series regression detection reads, so it holds
the percentiles and what was achieved and stays a few kilobytes.

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

# Past this fraction of dropped requests a target is serving less than it was offered, so
# its percentiles describe the requests that survived rather than the load it was given.
SATURATION = 0.01


def saturated(rung_row):
    offered = rung_row["offered_rps"] * rung_row["seconds"]
    return offered > 0 and rung_row["dropped"] / offered > SATURATION

def readable(obj, indent=0):
    """Indented structure, but a leaf stays on one line.

    Plain json.dumps(indent=2) puts every one of the per-endpoint numbers on its own line,
    which quadruples the file and makes it unreadable in a browser anyway. A leaf is an
    array or an object holding only scalars: one rung's nine statistics belong on one line,
    the same as the numeric arrays they replaced.
    """
    pad, inner = "  " * indent, "  " * (indent + 1)
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        if all(not isinstance(v, (dict, list)) for v in obj.values()):
            return json.dumps({k: obj[k] for k in sorted(obj)}, separators=(",", ":"))
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
    # Nothing is divided by anything. What a run publishes is the time each target took,
    # and the reference below is the target the conformance gate compared responses
    # against, which is a statement about correctness rather than about speed.
    languages = env["languages"]
    references = env.get("references") or env.get("baselines") or {}
    first = languages[0]
    language_of = {r["target"]: r.get("language", first) for r in rungs}
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
        "run_id": env["run_id"], "date": env["run_id"][:10],
        "suite": env["suite"], "epoch": env["epoch"], "mode": env.get("mode", "local"),
        # Rung ids are reused across ladder versions while the rates behind them change,
        # so two summaries can agree on "rung 2" and mean different offered loads.
        "ladder": env.get("ladder", "ladder-v1"),
        # Which endpoints were live. A narrowed run is a different profile, not the full
        # blend with rows hidden, so nothing may read the two against each other.
        "profile": env.get("profile", "full"),
        "endpoints_live": env.get("endpoints_live", len(ep_order)),
        "machine": env.get("machine", {}),
        "runner": a.runner, "tracked": a.tracked,
        "exec_host": env.get("exec_host") or "container",
        "host": env["host"], "cpu": env["cpu"], "cores": env["cores"],
        "sut_cpus": env.get("sut_cpus", ""), "gen_cpus": env.get("gen_cpus", ""),
        "runtime": env["runtime"], "generator": env["generator"],
        "references": references, "languages": languages,
        "cross_language": env.get("cross_language", False),
        # What code produced these numbers. The raw JSONL carries it too, but that is a
        # 90-day artifact and this file is kept forever, so dropping it here is what makes
        # a number permanently unattributable. Neither can be backfilled onto a past run.
        "commit": env.get("commit", ""), "repo": env.get("repo", ""),
        "rungs": rung_ids, "targets": [],
        # Ordering only. Every statistic is keyed by endpoint id inside each target, so a
        # name missing from here or out of place changes what order rows are drawn in and
        # can never attach a number to the wrong endpoint.
        "endpoint_order": ep_order,
    }
    for t in targets:
        m = meta.get(t, {})
        entry = {"target": t, "language": language_of.get(t, first),
                 "exec_host": meta.get(t, {}).get("host", env.get("host", "container")),
                 "reference": references.get(language_of.get(t, first)),
                 "framework": m.get("framework", t),
                 "version": m.get("version", ""), "target_runtime": m.get("runtime", ""),
                 # What the host put in front of the framework. A bump here moves the
                 # numbers with the framework version unchanged, so it is recorded next to
                 # it rather than left to the lockfile.
                 "adapter": m.get("adapter", ""),
                 # Which JSON library did the serializing. Frameworks in one language do
                 # not always agree, and the choice moves the numbers.
                 "serializer": m.get("serializer", ""),
                 # And which template engine, which the Node targets report instead of a
                 # serializer. Reading only `serializer` left the column empty for every
                 # Node and Go row and discarded the one field that explains the template
                 # family, where handlebars and html/template are not the same product.
                 "template": m.get("template", ""),
                 # The bundle this target was: code_hash excludes prose, so a corrected
                 # README does not read as a target that changed.
                 "bundle_hash": m.get("bundle_hash", ""),
                 "code_hash": m.get("code_hash", ""),
                 "rungs": {}, "families": {}, "families_by_rung": {}}
        for rn in rung_ids:
            r = by.get((t, rn))
            if not r:
                continue
            # A rate the target did not complete publishes no latency. gen/blend.mjs drops
            # by never sending, so the percentiles describe the requests that survived and
            # omit the ones that would have been slowest: the harder a target collapses,
            # the better its p99 looks. What it achieved and what it dropped are the
            # honest numbers at that point, and they are the ones kept.
            done = r.get("completed", True)
            entry["rungs"][str(rn)] = {
                "rate": r.get("rate", str(rn)),
                "completed": done,
                "saturated": saturated(r),
                "offered_rps": r["offered_rps"], "achieved_rps": r["achieved_rps"],
                "dropped": r["dropped"], "errors": r["errors"],
                "status_mismatch": r["status_mismatch"],
                "p50_us": r["p50_us"] if done else None,
                "p99_us": r["p99_us"] if done else None,
                "p999_us": r["p999_us"] if done else None,
            }
        # Per endpoint, per rung, every statistic the histogram can answer, keyed by the
        # endpoint's own id. This was parallel arrays indexed by endpoint_order, which
        # cost 31% less gzipped and put the correctness of every published number on a
        # convention four separate readers had to honour. Nothing is dropped for size: the
        # repository is public, so neither Actions minutes nor storage is billed, and a
        # percentile discarded here is one the 90-day artifact retention takes with it.
        eps = {}
        for eid in ep_order:
            rungs = {}
            for rn in rung_ids:
                row = ep_hist.get((t, rn, eid))
                if not row or not row.get("completed", True):
                    continue
                h = unpack(row["hist_b64"])
                p50, p90 = pct(h, 50), pct(h, 90)
                p95, p99, p999 = pct(h, 95), pct(h, 99), pct(h, 99.9)
                rungs[str(rn)] = {
                    "count": row["count"], "errors": row.get("errors", 0),
                    "mismatch": row.get("mismatch", 0),
                    "p50_us": p50, "p90_us": p90, "p95_us": p95,
                    "p99_us": p99, "p999_us": p999,
                }
            if rungs:
                eps[eid] = {"family": ep_family[eid], "rungs": rungs}
        entry["endpoints"] = eps

        # The flat `families` copy is the first rate, which is the one every target is
        # expected to complete. Picking the middle of the list gave the raised rate once
        # the ladder became two, so the copy was empty for exactly the targets that could
        # not sustain it -- the ones a reader is looking for.
        flat = rung_ids[0]
        # Families at every rung too, not just the flat one, with the same percentiles.
        for rn in rung_ids:
            for f, hs in fam.get((t, rn), {}).items():
                merged = [0] * NBUCKETS
                for h in hs:
                    for i, c in enumerate(unpack(h)):
                        merged[i] += c
                rec = {"p50_us": pct(merged, 50), "p90_us": pct(merged, 90),
                       "p99_us": pct(merged, 99), "p999_us": pct(merged, 99.9),
                       "count": sum(merged)}
                entry["families_by_rung"].setdefault(str(rn), {})[f] = rec
            if rn == flat:
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
