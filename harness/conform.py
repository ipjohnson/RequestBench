"""Conformance gate. A target is not measured until it passes.

Replays every instance in spec/plan.json, asserts the status, and fingerprints each
response body canonically so two targets that disagree semantically are caught here
rather than surfacing later as an unexplained latency difference.

  python3 harness/conform.py 127.0.0.1:8080 [--fingerprint f.json] [--compare ref.json]
"""
import json, sys, hashlib, pathlib, argparse, http.client, collections

# What a response has to carry regardless of framework. Latency says nothing about any of
# it, and frameworks differ more here than anywhere else.
HEADER_RULES = {
    201: [("location", "present", "a 201 must say where the thing was created")],
}
ALWAYS = [("content-type", "present", "every response must declare its type"),
          ("content-length", "present", "every response must declare its length")]
NO_BODY = {204, 304}
LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations"


def as_event(method, path, body):
    """An API Gateway v2 event, shaped the same way gen/serial.mjs shapes it."""
    qi = path.find("?")
    raw_path = path if qi == -1 else path[:qi]
    qs = "" if qi == -1 else path[qi + 1:]
    from urllib.parse import parse_qsl
    return json.dumps({
        "version": "2.0", "rawPath": raw_path, "rawQueryString": qs,
        "queryStringParameters": dict(parse_qsl(qs)),
        "headers": {"content-type": "application/json"},
        "requestContext": {"http": {"method": method, "path": raw_path}},
        "body": body, "isBase64Encoded": False,
    })


def unwrap(raw):
    """Turn the Lambda result envelope back into (status, headers, body), so the
    fingerprint and the header contract are compared on the same ground as any other
    host. A response that differs across hosts is a bug, not a host characteristic."""
    env = json.loads(raw)
    hdrs = list((env.get("headers") or {}).items())
    body = env.get("body") or ""
    if env.get("isBase64Encoded"):
        import base64 as _b64
        return env["statusCode"], hdrs, _b64.b64decode(body)
    return env["statusCode"], hdrs, body.encode()


def header_bytes(headers):
    """Approximate wire cost: name, colon-space, value, CRLF per header."""
    return sum(len(k) + len(v) + 4 for k, v in headers)


def framing(headers):
    got = {k.lower(): v for k, v in headers}
    if "content-length" in got:
        return "content-length"
    if "chunked" in got.get("transfer-encoding", ""):
        return "chunked"
    return "none"


def check_headers(status, headers, body):
    got = {k.lower(): v for k, v in headers}
    problems = []
    for name, rule, why in ALWAYS + HEADER_RULES.get(status, []):
        if status in NO_BODY and name in ("content-length", "content-type"):
            continue
        # Chunked framing declares the length differently; both are valid, and which one a
        # framework picks is worth recording rather than failing.
        if name == "content-length" and framing(headers) == "chunked":
            continue
        if rule == "present" and name not in got:
            problems.append("missing %s (%s)" % (name, why))
    cl = got.get("content-length")
    if cl is not None and cl.isdigit() and int(cl) != len(body):
        problems.append("content-length %s but body is %d bytes" % (cl, len(body)))
    if "content-type" in got and body and body.lstrip()[:1] in (b"{", b"["):
        if "json" not in got["content-type"]:
            problems.append("JSON body served as %s" % got["content-type"])
    return problems

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
    ap.add_argument("--exemplars", metavar="FILE",
                    help="write one captured request/response pair per endpoint here")
    ap.add_argument("--encoding", choices=["http", "lambda"], default="http",
                    help="lambda posts an API Gateway v2 event to the RIE invocations "
                         "endpoint and unwraps the returned envelope")
    ap.add_argument("--skip-headers", action="store_true",
                    help="do not enforce the response header contract")
    a = ap.parse_args()

    host, _, port = a.hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port or 80), timeout=15)
    ref = json.loads(pathlib.Path(a.compare).read_text()) if a.compare else None

    prints, failures, drift, sent = {}, [], [], 0
    exemplars, header_problems, seen_once = [], [], set()

    meta = {}
    try:
        conn.request("GET", "/__meta")
        r = conn.getresponse()
        meta = json.loads(r.read())
    except Exception:
        conn.close()
        conn = http.client.HTTPConnection(host, int(port or 80), timeout=15)
    for ep in PLAN["endpoints"]:
        paths = ep["paths"][: a.instances] if a.instances else ep["paths"]
        body = ep.get("body")
        headers = {"accept": "application/json"}
        if body:
            headers["content-type"] = "application/json"
        seen, bad = collections.Counter(), None
        for path in paths:
            try:
                if a.encoding == "lambda":
                    event = as_event(ep["method"], path, body)
                    conn.request("POST", LAMBDA_INVOKE, body=event,
                                 headers={"content-type": "application/json"})
                    r = conn.getresponse()
                    envelope = r.read()
                    if r.status != 200:
                        raise RuntimeError("RIE returned %d" % r.status)
                    status, hdrs, raw = unwrap(envelope)
                    ctype = dict((k.lower(), v) for k, v in hdrs).get("content-type")
                else:
                    conn.request(ep["method"], path, body=body, headers=headers)
                    r = conn.getresponse()
                    raw, status, ctype = r.read(), r.status, r.headers.get("content-type")
                    hdrs = list(r.headers.items())
            except Exception as e:
                conn.close()
                conn = http.client.HTTPConnection(host, int(port or 80), timeout=15)
                status, raw, ctype, hdrs = 0, b"", None, []
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
                if ep["id"] not in seen_once:
                    seen_once.add(ep["id"])
                    if not a.skip_headers:
                        for msg in check_headers(status, hdrs, raw):
                            header_problems.append((ep["id"], msg))
                    exemplars.append({
                        "endpoint": ep["id"], "family": ep["family"],
                        "request": {
                            "method": ep["method"], "path": path,
                            "headers": sorted(headers.items()),
                            "body": (body[:2048] if body else None),
                            "body_bytes": len(body.encode()) if body else 0,
                        },
                        "response": {
                            "status": status, "headers": hdrs,
                            "header_bytes": header_bytes(hdrs),
                            "framing": framing(hdrs),
                            "body_bytes": len(raw),
                            "body": raw[:2048].decode("utf-8", "replace"),
                            "truncated": len(raw) > 2048,
                        },
                    })

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
    if header_problems:
        print("  %d response header problem(s):" % len(header_problems))
        for eid, msg in header_problems[:12]:
            print("    %-18s %s" % (eid, msg))
    if a.exemplars:
        out = pathlib.Path(a.exemplars)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "framework": meta.get("framework", ""), "version": meta.get("version", ""),
            "runtime": meta.get("runtime", ""), "blend": PLAN["version"],
            "endpoints": exemplars,
        }, indent=1))
        print("  exemplars -> %s (%d endpoints, %.1f KB)"
              % (out, len(exemplars), out.stat().st_size / 1024))
    if a.fingerprint:
        pathlib.Path(a.fingerprint).write_text(json.dumps(prints, indent=2, sort_keys=True))
        print("  fingerprints -> %s" % a.fingerprint)
    conn.close()
    return 1 if failures or drift or header_problems else 0

if __name__ == "__main__":
    sys.exit(main())
