"""Conformance gate. A target is not measured until it passes.

Replays every instance in spec/plan.json, asserts the status, and fingerprints each
response body canonically so two targets that disagree semantically are caught here
rather than surfacing later as an unexplained latency difference.

  python3 harness/conform.py 127.0.0.1:8080 [--fingerprint f.json] [--compare ref.json]
"""
import json, sys, hashlib, pathlib, argparse, http.client, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "spec" / "plan.json").read_text())

def canonical(raw, ctype):
    if not raw:
        return "empty"
    if "json" in (ctype or ""):
        try:
            return hashlib.sha256(json.dumps(json.loads(raw), sort_keys=True,
                                             separators=(",", ":")).encode()).hexdigest()[:16]
        except Exception:
            return "unparseable-json"
    return hashlib.sha256(raw).hexdigest()[:16]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hostport")
    ap.add_argument("--instances", type=int, default=0, help="0 = every instance")
    ap.add_argument("--fingerprint")
    ap.add_argument("--compare")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    host, _, port = a.hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port or 80), timeout=15)
    ref = json.loads(pathlib.Path(a.compare).read_text()) if a.compare else None

    prints, failures, drift, sent = {}, [], [], 0
    for ep in PLAN["endpoints"]:
        paths = ep["paths"][: a.instances] if a.instances else ep["paths"]
        body = ep.get("body")
        headers = {"accept": "application/json"}
        if body:
            headers["content-type"] = "application/json"
        seen, bad = collections.Counter(), None
        for path in paths:
            try:
                conn.request(ep["method"], path, body=body, headers=headers)
                r = conn.getresponse()
                raw, status, ctype = r.read(), r.status, r.headers.get("content-type")
            except Exception as e:
                conn.close()
                conn = http.client.HTTPConnection(host, int(port or 80), timeout=15)
                status, raw, ctype = 0, b"", None
                bad = bad or "transport:%s" % type(e).__name__
            sent += 1
            seen[status] += 1
            if status != ep["expect"] and bad is None:
                bad = "expected %d, got %d on %s" % (ep["expect"], status, path)
            # Only a response that actually arrived with the right status may define the
            # endpoint's fingerprint; otherwise a single early hiccup gets recorded as the
            # reference body and every later comparison reports drift that is not real.
            if status == ep["expect"]:
                prints.setdefault(ep["id"], canonical(raw, ctype))

        ok = set(seen) == {ep["expect"]}
        if not ok:
            failures.append((ep["id"], bad or "mixed statuses %s" % dict(seen)))
        note = ""
        if ref and ep["id"] in ref and ep["id"] in prints and ref[ep["id"]] != prints[ep["id"]]:
            note, _ = "  <- body differs from reference", drift.append(ep["id"])
        if not a.quiet:
            print("  %s %-18s %-6s %-3d instances  %s%s" %
                  ("ok  " if ok else "FAIL", ep["id"], ep["method"], len(paths),
                   dict(seen) if not ok else ep["expect"], note))

    total = len(PLAN["endpoints"])
    print("\n%d/%d endpoints conform  (%d requests sent)" % (total - len(failures), total, sent))
    for eid, why in failures:
        print("  FAIL %-18s %s" % (eid, why))
    if drift:
        print("  %d body mismatch(es) vs reference: %s" % (len(drift), ", ".join(drift)))
    if a.fingerprint:
        pathlib.Path(a.fingerprint).write_text(json.dumps(prints, indent=2, sort_keys=True))
        print("  fingerprints -> %s" % a.fingerprint)
    conn.close()
    return 1 if failures or drift else 0

if __name__ == "__main__":
    sys.exit(main())
