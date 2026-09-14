"""Which shard and suite does a given night run?

The schedule lives here rather than in YAML so it is testable and so a workflow only has
to ask. Day of week picks the shard; ISO week parity picks the suite.

  python3 harness/rotation.py                     # tonight
  python3 harness/rotation.py --date 2026-09-21   # a specific night
  python3 harness/rotation.py --shard go          # override the shard, keep the suite
  python3 harness/rotation.py --github-output     # key=value lines for $GITHUB_OUTPUT
  python3 harness/rotation.py --calendar          # the whole fortnight
"""
import argparse, datetime as dt, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATRIX = json.loads((ROOT / "spec" / "matrix.json").read_text())
ROT = MATRIX["rotation"]

def resolve(day: dt.date):
    iso = day.isocalendar()
    shard = ROT["days"][str(iso.weekday)]
    suite = ROT["suites"]["odd" if iso.week % 2 else "even"]
    out = {"date": day.isoformat(), "iso_week": iso.week, "weekday": iso.weekday,
           "shard": shard, "suite": suite}
    if shard == "anchor":
        out["targets"] = ",".join("%s:%s" % (l, MATRIX["languages"][l]["anchor"])
                                  for l in MATRIX["languages"])
    else:
        out.update(shard_targets(shard))
    return out


def shard_targets(shard):
    """Only what exists. 'frameworks' is the plan; 'implemented' is what a runner can boot."""
    lang = MATRIX["languages"][shard]
    built = lang.get("implemented", [])
    return {
        "shard": shard,
        "targets": ",".join([lang["baseline"]] + built) if built else "",
        "planned": ",".join([lang["baseline"]] + lang["frameworks"]),
        "built": len(built),
        "warmup_class": "jit" if shard in MATRIX["warmup_classes"]["jit"] else "steady",
    }

def host_targets(host):
    """Every implemented target, in every language that supports this host.

    A job is one suite on one host and holds all of them, so there is no language
    dimension: every run is cross-language by construction rather than by a separate job.
    """
    out = []
    for shard, lang in MATRIX["languages"].items():
        built = lang.get("implemented", [])
        hosts = MATRIX.get("hosts_implemented", {}).get(shard, ["container"])
        if not built or host not in hosts:
            continue
        out += ["%s:%s" % (shard, t) for t in [lang["baseline"]] + built]
    return out


def suite_for(host):
    """A host that runs one invocation at a time has no knee to find."""
    return "blend" if host == "container" else "serial"


def cross_targets():
    """Every implemented target in every language, as shard:target pairs.

    One job, one machine, everything back to back. Ratios stay within a language because
    each language's baseline is in the list; absolutes become comparable across languages
    because nothing moved between targets.
    """
    out = []
    for shard, lang in MATRIX["languages"].items():
        built = lang.get("implemented", [])
        if not built:
            continue
        out += ["%s:%s" % (shard, t) for t in [lang["baseline"]] + built]
    return out


def override_shard(r, shard):
    """Keep the night's suite, but measure a shard the operator named."""
    r.update(shard_targets(shard))
    r["overridden"] = True
    return r


def main(argv):
    if "--calendar" in argv:
        start = dt.date.today()
        start -= dt.timedelta(days=start.isocalendar().weekday - 1)
        print("%-12s %-5s %-9s %-11s %s" % ("date", "week", "shard", "suite", "targets"))
        for i in range(14):
            r = resolve(start + dt.timedelta(days=i))
            print("%-12s %-5d %-9s %-11s %s"
                  % (r["date"], r["iso_week"], r["shard"], r["suite"], r["targets"][:52]))
        return 0
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="")
    ap.add_argument("--shard", default="auto")
    ap.add_argument("--github-output", action="store_true",
                    help="emit key=value lines instead of JSON")
    ap.add_argument("--cross", action="store_true",
                    help="every implemented target in every language, as shard:target")
    ap.add_argument("--host", default="",
                    help="every implemented target that supports this execution host")
    a = ap.parse_args(argv[1:])

    day = dt.date.fromisoformat(a.date) if a.date else dt.date.today()
    if a.host:
        pairs = host_targets(a.host)
        r = {"date": day.isoformat(), "host": a.host, "shard": a.host,
             "suite": suite_for(a.host), "targets": ",".join(pairs), "built": len(pairs)}
        if a.github_output:
            for k in ("date", "host", "suite", "targets"):
                print("%s=%s" % (k, r[k]))
            print("built=%d" % r["built"])
        else:
            print(json.dumps(r))
        return 0
    if a.cross:
        pairs = cross_targets()
        r = {"date": day.isoformat(), "shard": "cross", "suite": "blend",
             "targets": ",".join(pairs), "built": len(pairs)}
        if a.github_output:
            for k in ("date", "shard", "suite", "targets"):
                print("%s=%s" % (k, r[k]))
            print("built=%d" % r["built"])
        else:
            print(json.dumps(r))
        return 0
    r = resolve(day)
    if a.shard and a.shard != "auto":
        if a.shard not in MATRIX["languages"]:
            sys.exit("unknown shard %r; known: %s" % (a.shard, ", ".join(MATRIX["languages"])))
        r = override_shard(r, a.shard)
    if a.github_output:
        for k in ("date", "shard", "suite", "targets"):
            print("%s=%s" % (k, r.get(k, "")))
        print("built=%d" % r.get("built", 0))
    else:
        print(json.dumps(r))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
