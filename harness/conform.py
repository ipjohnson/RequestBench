"""Conformance gate. A target is not measured until it passes.

Replays every instance in spec/plan.json and asserts the status, then compares each
distinct request's response against a reference target measured in the same run, so two
targets that disagree semantically are caught here rather than surfacing later as an
unexplained latency difference.

Responses are compared as parsed values rather than as bytes. Key order and number
formatting follow whatever each language's serializer does and mean nothing, and a
mismatch should say which field differs rather than that two digests do not match.

  python3 harness/conform.py 127.0.0.1:8080 [--reference ref.json] [--compare ref.json]
"""
import json, sys, pathlib, argparse, http.client, collections, re, zlib

# What a response has to carry regardless of framework. Latency says nothing about any of
# it, and frameworks differ more here than anywhere else.
HEADER_RULES = {
    201: [("location", "present", "a 201 must say where the thing was created")],
}
ALWAYS = [("content-type", "present", "every response must declare its type"),
          ("content-length", "present", "every response must declare its length")]
NO_BODY = {204, 304}
LAMBDA_INVOKE = "/2015-03-31/functions/function/invocations"

# Families whose responses carry x-rb-serial, a per-process counter proving the handler ran
# and the response came from it rather than from a cache anywhere in the path.
FRESH = ("compressed.", "cached.")


def as_event(method, path, body, headers=None):
    """An API Gateway v2 event, shaped the same way gen/serial.mjs shapes it."""
    qi = path.find("?")
    raw_path = path if qi == -1 else path[:qi]
    qs = "" if qi == -1 else path[qi + 1:]
    from urllib.parse import parse_qsl
    return json.dumps({
        "version": "2.0", "rawPath": raw_path, "rawQueryString": qs,
        "queryStringParameters": dict(parse_qsl(qs)),
        "headers": {**(headers or {}),
                    "content-type": "application/json", "host": "rb.invalid"},
        "requestContext": {"http": {"method": method, "path": raw_path}},
        "body": body, "isBase64Encoded": False,
    })


def unwrap(raw):
    """Turn the Lambda result envelope back into (status, headers, body), so the
    fingerprint and the header contract are compared on the same ground as any other
    host. A response that differs across hosts is a bug, not a host characteristic."""
    env = json.loads(raw)
    # The envelope is JSON, so an adapter can give a header value as a number where HTTP
    # would always have given a string. Normalise here, once, rather than in every reader.
    hdrs = [(k, v if isinstance(v, str) else str(v))
            for k, v in (env.get("headers") or {}).items()]
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


def check_headers(status, headers, body, encoding="http"):
    got = {k.lower(): v for k, v in headers}
    problems = []
    for name, rule, why in ALWAYS + HEADER_RULES.get(status, []):
        if status in NO_BODY and name in ("content-length", "content-type"):
            continue
        # Chunked framing declares the length differently; both are valid, and which one a
        # framework picks is worth recording rather than failing.
        if name == "content-length" and framing(headers) == "chunked":
            continue
        # A Lambda handler returns a JSON envelope, not an HTTP response. API Gateway sets
        # the length downstream, so demanding the function declare it tests the wrong layer.
        if name == "content-length" and encoding == "lambda":
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

def decoded(raw, headers):
    """The bytes to fingerprint, which are not always the bytes on the wire.

    gzip output differs between zlib, Java's Deflater and Go's compress/flate at the same
    level. The decompressed bytes must not, so the fingerprint is taken over those. The
    wire bytes are still what the content-length contract is checked against.
    """
    enc = {k.lower(): v for k, v in headers}.get("content-encoding", "")
    if raw and "gzip" in enc:
        try:
            return zlib.decompress(raw, 16 + zlib.MAX_WBITS)
        except zlib.error:
            return raw
    return raw


def serial_of(headers, previous):
    v = {k.lower(): v for k, v in headers}.get("x-rb-serial")
    return int(v) if v is not None and v.isdigit() else previous


def advanced(headers, previous):
    """Why x-rb-serial is unacceptable on this response, or None.

    A target that served a response from a cache anywhere in its own path, or precomputed
    it at boot, repeats a counter it did not increment. Identical bytes are the whole point
    of the fingerprint, so this is the only thing that can tell the two apart.
    """
    v = {k.lower(): v for k, v in headers}.get("x-rb-serial")
    if v is None:
        return "no x-rb-serial (the response must prove the handler ran)"
    if not v.isdigit():
        return "x-rb-serial %r is not a number" % v
    if previous is not None and int(v) <= previous:
        return "x-rb-serial did not advance (%s after %d)" % (v, previous)
    return None


def comparable(raw, ctype):
    """The response as a value, not as bytes.

    Two targets that mean the same thing can write it differently: key order follows
    whatever the language's serializer does, and a number can come back 18928 or 18928.0.
    Parsing first makes those stop mattering, and it makes a mismatch legible -- the
    failure names the field that differs instead of two hex strings that do not match.
    """
    if not raw:
        return None
    if "json" in (ctype or ""):
        try:
            return json.loads(raw)
        except Exception:
            return "unparseable-json"
    if "html" in (ctype or ""):
        # Five template engines cannot agree on formatting without every template being
        # contorted to match, so the spec pins content and leaves whitespace free: same
        # elements, same order, same values.
        #
        # Collapsing runs is not enough on its own to make it free. It leaves an engine's
        # indentation as a space where a string concat has nothing, so the two still differ
        # and no engine could ever match. Whitespace at an element boundary goes entirely;
        # whitespace inside text is collapsed and kept, because there it is content.
        raw = re.sub(rb"\s+", b" ", raw)
        raw = re.sub(rb">\s+", b">", raw)
        raw = re.sub(rb"\s+<", b"<", raw)
        raw = raw.strip()
    return raw.decode("utf-8", "replace")


def first_difference(a, b, path="response"):
    """Where two parsed responses stop agreeing, as something a person can act on."""
    if type(a) is not type(b) and not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        return "%s: %s vs %s" % (path, type(a).__name__, type(b).__name__)
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                return "%s.%s: missing here, present in the reference" % (path, k)
            if k not in b:
                return "%s.%s: present here, missing in the reference" % (path, k)
            d = first_difference(a[k], b[k], "%s.%s" % (path, k))
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return "%s: %d items vs %d" % (path, len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_difference(x, y, "%s[%d]" % (path, i))
            if d:
                return d
        return None
    if a != b:
        return "%s: %r vs %r" % (path, a, b)
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hostport")
    ap.add_argument("--instances", type=int, default=0, help="0 = every instance")
    ap.add_argument("--reference", metavar="FILE",
                    help="write this target's responses here, to compare later targets "
                         "in the same run against")
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

    # Keyed by endpoint and path, because the instances of one endpoint are different
    # requests: /domain/orders/602 and /domain/orders/876 return different orders, so one
    # value per endpoint could only ever check the first of them. The plan holds 3,346
    # distinct requests against 23,040 instances, and 34 of the 45 endpoints send the same
    # request every time, so keeping them all costs a couple of megabytes.
    responses, failures, drift, sent, compared = {}, [], [], 0, 0
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
        # The same request gen/blend.mjs sends: the endpoint's own headers, plus a
        # content-type when there is a body. The gate used to add an accept the generator
        # never sends, which meant a content-negotiating target could be gated on one
        # response and measured on another.
        headers = dict(ep.get("headers") or {})
        if body:
            headers["content-type"] = "application/json"
        fresh = ep["id"].startswith(FRESH) and not a.skip_headers
        seen, bad, stale, last_serial = collections.Counter(), None, None, None
        for path in paths:
            try:
                if a.encoding == "lambda":
                    event = as_event(ep["method"], path, body, headers)
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
            if fresh and status == ep["expect"]:
                stale = stale or advanced(hdrs, last_serial)
                last_serial = serial_of(hdrs, last_serial)
            if status == ep["expect"]:
                responses.setdefault(ep["id"] + " " + path, comparable(decoded(raw, hdrs), ctype))
                if ep["id"] not in seen_once:
                    seen_once.add(ep["id"])
                    if not a.skip_headers:
                        for msg in check_headers(status, hdrs, raw, a.encoding):
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

        ok = set(seen) == {ep["expect"]} and stale is None
        if not ok:
            failures.append((ep["id"], bad or stale or "mixed statuses %s" % dict(seen)))
        note = ""
        if ref:
            for key in (ep["id"] + " " + pth for pth in dict.fromkeys(paths)):
                if key not in ref or key not in responses:
                    continue
                compared += 1
                diff = first_difference(responses[key], ref[key])
                if diff:
                    note = "  <- " + diff
                    drift.append((ep["id"], diff))
                    break
        if not a.quiet:
            print("  %s %-18s %-6s %-3d instances  %s%s" %
                  ("ok  " if ok else "FAIL", ep["id"], ep["method"], len(paths),
                   dict(seen) if not ok else ep["expect"], note))

    total = len(PLAN["endpoints"])
    print("\n%d/%d endpoints conform  (%d requests sent)" % (total - len(failures), total, sent))
    for eid, why in failures:
        print("  FAIL %-18s %s" % (eid, why))
    if drift:
        # The first difference goes on the header line, because run.py reports the summary
        # and the line after it. A count with the detail on the next line down told the
        # reader a response differed without saying how.
        print("  %d response(s) differ from the reference: %s %s"
              % (len(drift), drift[0][0], drift[0][1]))
        for eid, diff in drift[1:12]:
            print("    %-18s %s" % (eid, diff))
    # A reference from a target that does not serve the whole spec can only check the part
    # it does serve. Saying so keeps a thin comparison from reading like a clean pass.
    if ref is not None and not drift:
        print("  %d/%d responses compared against the reference%s"
              % (compared, len(responses),
                 "" if compared == len(responses)
                 else "; the reference does not cover the rest"))
    if header_problems:
        print("  %d response header problem(s):" % len(header_problems))
        for eid, msg in header_problems[:12]:
            print("    %-18s %s" % (eid, msg))
    if a.exemplars:
        out = pathlib.Path(a.exemplars)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "framework": meta.get("framework", ""), "version": meta.get("version", ""),
            "runtime": meta.get("runtime", ""), "adapter": meta.get("adapter", ""),
            "blend": PLAN["version"],
            "endpoints": exemplars,
        }, indent=1))
        print("  exemplars -> %s (%d endpoints, %.1f KB)"
              % (out, len(exemplars), out.stat().st_size / 1024))
    if a.reference:
        out = pathlib.Path(a.reference)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(responses, sort_keys=True))
        print("  reference -> %s (%d requests, %.1f KB)"
              % (out, len(responses), out.stat().st_size / 1024))
    conn.close()
    return 1 if failures or drift or header_problems else 0

if __name__ == "__main__":
    sys.exit(main())
