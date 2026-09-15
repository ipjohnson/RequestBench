"""Which targets does an execution host run, and under which suite?

A job is one suite on one host and holds every implemented target that host supports.
This answers by host alone; it knows nothing about dates.

  python3 harness/hosts.py --host container            # what that host would measure
  python3 harness/hosts.py --host lambda-rie --github-output
  python3 harness/hosts.py --list                      # every host, with what it holds
"""
import argparse, datetime as dt, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATRIX = json.loads((ROOT / "spec" / "matrix.json").read_text())


def host_targets(host):
    """Every implemented target, in every language that supports this host."""
    out = []
    exceptions = MATRIX.get("host_exceptions", {})
    for language, entry in MATRIX["languages"].items():
        built = entry.get("implemented", [])
        hosts = MATRIX.get("hosts_implemented", {}).get(language, ["container"])
        if not built or host not in hosts:
            continue
        for t in [entry["baseline"]] + built:
            # A framework can be unable to run on a host its language otherwise supports.
            if host in exceptions.get("%s:%s" % (language, t), {}).get("excluded", []):
                continue
            out.append("%s:%s" % (language, t))
    return out


def suite_for(host):
    """A host that runs one invocation at a time has no knee to find."""
    return "blend" if host == "container" else "serial"


def resolve(host):
    pairs = host_targets(host)
    return {"date": dt.date.today().isoformat(), "host": host, "suite": suite_for(host),
            "targets": ",".join(pairs), "built": len(pairs)}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="",
                    help="every implemented target that supports this execution host")
    ap.add_argument("--github-output", action="store_true",
                    help="emit key=value lines instead of JSON")
    ap.add_argument("--list", action="store_true",
                    help="every known host and how much it would run")
    a = ap.parse_args(argv[1:])

    if a.list:
        print("%-12s %-7s %-6s %s" % ("host", "suite", "built", "targets"))
        for host in MATRIX["hosts"]:
            r = resolve(host)
            print("%-12s %-7s %-6d %s" % (host, r["suite"], r["built"], r["targets"][:56]))
        return 0
    if not a.host:
        ap.error("pass --host, or --list to see every host")
    if a.host not in MATRIX["hosts"]:
        sys.exit("unknown host %r; known: %s" % (a.host, ", ".join(MATRIX["hosts"])))

    r = resolve(a.host)
    if a.github_output:
        for k in ("date", "host", "suite", "targets"):
            print("%s=%s" % (k, r[k]))
        print("built=%d" % r["built"])
    else:
        print(json.dumps(r))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
