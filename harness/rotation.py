"""Which shard and suite does a given night run?

The schedule lives here rather than in YAML so it is testable and so a workflow only has
to ask. Day of week picks the shard; ISO week parity picks the suite.

  python3 harness/rotation.py            # tonight
  python3 harness/rotation.py 2026-09-21 # a specific night
  python3 harness/rotation.py --calendar # the whole fortnight
"""
import datetime as dt, json, pathlib, sys

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
        lang = MATRIX["languages"][shard]
        out["targets"] = ",".join([lang["baseline"]] + lang["frameworks"])
        out["warmup_class"] = ("jit" if shard in MATRIX["warmup_classes"]["jit"] else "steady")
    return out

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
    day = dt.date.fromisoformat(argv[1]) if len(argv) > 1 else dt.date.today()
    print(json.dumps(resolve(day)))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
