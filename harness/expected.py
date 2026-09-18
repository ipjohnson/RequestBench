"""What every target must answer, decided once and committed.

  python3 harness/expected.py --write            # boot the agreeing targets, write spec/expected.json
  python3 harness/expected.py --check            # is the committed file still what they agree on

Until now a target was gated against another target booted minutes earlier in the same
run. Agreement between two frameworks is evidence that they are consistent; it is not
evidence that either is right, and nothing in the repository said what the right answer
was. This produces that statement.

It is derived rather than hand-written, because fifty endpoints against a 2,431-entry
plan is not a file anyone can author correctly. The derivation is only trustworthy because
of what it insists on: every contributing target must answer identically, and they are
independent implementations in four languages against four different HTTP stacks. A value
only one of them produces is not written, it is reported as a disagreement and resolved
against spec/endpoints.json by hand before this runs again.

Once written the file is the authority. A target that disagrees with it is wrong, however
many other targets share the mistake, and changing it is a deliberate edit with a reason,
not a side effect of rerunning a generator.

A value drawn once per run is not an expectation, because the next run draws another. This
draws its own, sends the same ones to every target it boots, and writes each echoed value
back as the {run.<name>} placeholder it came from. A driver fills that in with whatever it
sent.
"""
import argparse
import collections
import hashlib
import http.client
import json
import pathlib
import re
import sys
import urllib.parse
import zlib

import bundle
import run

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
PLAN = json.loads((SPEC / "plan.json").read_text())
OUT = SPEC / "expected.json"

EXPECTED_VERSION = "expected-v2"

# Four languages, four HTTP stacks, four independent implementations. Deriving from all
# twenty-eight would make the expectation a vote rather than an agreement, and a mistake
# shared by a whole language would carry it.
DEFAULT_CONTRIBUTORS = ("node:fastify", "go:gin", "rust:axum", "python:fastapi")

# Every distinct request in the plan, as one key. The instances of an endpoint are
# different requests -- /domain/orders/602 and /domain/orders/876 return different orders
# -- so one expectation per endpoint could only ever describe the first of them.
def keys_of(ep):
    return [(ep["id"] + " " + p) for p in dict.fromkeys(ep["paths"])]


def is_error(ep):
    """Whether this endpoint answers with an error body.

    Derived from the status rather than declared: an endpoint expecting 400 or above
    carries one. A 2xx body is the controlled variable and is pinned exactly; an error
    envelope is the framework's own contract and is not.
    """
    return max(ep.get("accepts") or [ep["expect"]]) >= 400


# What an error body has to say is no longer judged here. Each framework declares the
# envelope it answers in targets/<language>/<framework>/client-exception, and the client
# gates on that; this file used to look for the shared validator's own rule vocabulary,
# which stopped being anyone's after #35 gave every framework its own validator. What is
# still recorded per target is the shape, below.


def shape_of(node, path=""):
    """An error envelope with the values taken out: every key path and the type at it.

    What is being held still is the shape, not the contents. ASP.NET's ProblemDetails
    carries a traceId that changes per connection, so an exact body could never match
    twice; a key appearing, disappearing or changing type is what a changed envelope
    actually is.
    """
    kinds = {str: "string", bool: "bool", int: "number", float: "number", type(None): "null"}
    if isinstance(node, dict):
        if not node:
            return {path + "{}"}
        out = set()
        for key, value in node.items():
            out |= shape_of(value, (path + "." if path else "") + key)
        return out
    if isinstance(node, list):
        if not node:
            return {path + "[]"}
        out = set()
        for value in node:
            out |= shape_of(value, path + "[]")
        return out
    return {"%s:%s" % (path, kinds.get(type(node), "other"))}


def envelope(answer):
    """What is recorded for one target's error response."""
    return {
        "status": answer["status"],
        "body_class": answer["body_class"],
        "shape": sorted(shape_of(answer["body"])),
    }


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


def digest(path):
    return "sha256:" + hashlib.sha256((SPEC / path).read_bytes()).hexdigest()


def body_class(ctype):
    """What kind of body this is, which is part of the expectation rather than incidental.
    A target answering the right values as text/plain is not answering correctly."""
    ctype = (ctype or "").lower()
    if "json" in ctype:
        return "json"
    if "html" in ctype:
        return "html"
    if "text" in ctype:
        return "text"
    return "none" if not ctype else "other"


PLACEHOLDER = re.compile(r"\{capture\.([a-z_]+)\}")
RUN = re.compile(r"\{run\.([a-z_]+)\}")

# Drawn once for every target this derivation boots, so the contributors are sent the same
# values and their answers can agree.
VALUES = run.draw_values(PLAN["run_values"])


def in_url(path, values):
    """A path from the plan with every value in it, percent-encoded with a space as %20."""
    return RUN.sub(lambda m: urllib.parse.quote(str(values[m.group(1)]), safe=""), path)


def in_header(value, values):
    """A header value from the plan with every value in it, as it is."""
    return RUN.sub(lambda m: str(values[m.group(1)]), value)


def placeholders(ep, body, values):
    """The body with every value this endpoint echoes put back as its placeholder.

    Only a value that came back as it was sent is replaced. A contributor that echoed
    something else keeps what it answered, so it disagrees with the others instead of having
    its mistake written down as the expectation.
    """
    echo = body.get("echo") if isinstance(body, dict) else None
    if not ep.get("echo") or not isinstance(echo, dict):
        return body
    back = dict(echo)
    for name in ep["echo"]:
        got, sent = back.get(name), values[name]
        if got == sent and isinstance(got, str) == isinstance(sent, str) \
                and not isinstance(got, bool):
            back[name] = "{run.%s}" % name
    return dict(body, echo=back)


def resolve_captures(conn):
    """The header values only the target on the other end of this connection can supply.

    Every other request header in spec/plan.json is pre-resolved, because the same bytes
    have to reach every target. A matching If-None-Match cannot be: the etag family lets
    each framework's own machinery compute the validator, so the value is whatever this
    target answered. A capture that does not come back leaves the placeholder in place, and
    the endpoint that needs it answers 200 where it declared 304, which is reported as the
    disagreement it is.
    """
    out = {}
    for name, cap in (PLAN.get("captures") or {}).items():
        try:
            conn.request(cap["method"], cap["path"])
            r = conn.getresponse()
            r.read()
            value = r.headers.get(cap["header"])
        except Exception:
            conn.close()
            continue
        if value is not None:
            out[name] = value
    return out


def filled(headers, captured):
    return {k: PLACEHOLDER.sub(lambda m: captured.get(m.group(1), m.group(0)), v)
            for k, v in headers.items()}


def request_headers(ep, instance, captured, values):
    """What one instance of an endpoint carries. The vary rows send a different combination
    on each instance, so a response cache has a key per combination to hold; every other
    endpoint has one combination and this is it."""
    variants = ep.get("header_variants") or [{}]
    headers = dict(ep.get("headers") or {}, **variants[instance % len(variants)])
    if ep.get("body"):
        headers["content-type"] = "application/json"
    return {k: in_header(v, values) for k, v in filled(headers, captured).items()}


def capture(hostport):
    """Replay the plan against a running target and return what it answered.

    One entry per distinct request: the status, the kind of body, and the body as a value
    rather than as bytes. Key order and number formatting follow whatever the language's
    serializer does and mean nothing, so comparing parsed values is what keeps a real
    disagreement legible instead of two digests that do not match.
    """
    host, _, port = hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port or 80), timeout=20)
    captured = resolve_captures(conn)
    out = {}
    for ep in PLAN["endpoints"]:
        body = ep.get("body")
        headers = request_headers(ep, 0, captured, VALUES)
        for path in dict.fromkeys(ep["paths"]):
            key = ep["id"] + " " + path
            try:
                conn.request(ep["method"], in_url(path, VALUES), body=body, headers=headers)
                r = conn.getresponse()
                raw, status = r.read(), r.status
                hdrs = list(r.headers.items())
                ctype = r.headers.get("content-type")
            except Exception as e:
                conn.close()
                conn = http.client.HTTPConnection(host, int(port or 80), timeout=20)
                out[key] = {"status": 0, "body_class": "none", "encoding": "",
                            "body": "transport:%s" % type(e).__name__}
                continue
            lower = {k.lower(): v for k, v in hdrs}
            out[key] = {
                "status": status,
                "body_class": body_class(ctype),
                # Whether the body arrived compressed. The body below is the decompressed
                # value, so without this the compressed family proves only that a target
                # answered the right JSON -- a target that quietly stopped compressing
                # would pass. Fiber did exactly that, for a week.
                "encoding": lower.get("content-encoding", ""),
                "body": placeholders(ep, comparable(decoded(raw, hdrs), ctype), VALUES),
            }
    conn.close()
    return out


CACHE = ROOT / "results" / "captures"


def cache_path(language, target, mode):
    return CACHE / ("%s-%s.%s.json" % (language, target, mode))


def boot_and_capture(language, target, mode, port, cached=False):
    """Start the target the way a measurement would, wait for it to answer, replay.

    The capture is written beside the run so a second look at what a target answered costs
    nothing. Deriving the expectation is a read of four captures; rebooting four containers
    to reread them is how a person stops rerunning it.
    """
    out = cache_path(language, target, mode)
    if cached and out.exists():
        return json.loads(out.read_text())
    launcher = run.launcher(mode, language, target, port)
    launcher.start()
    try:
        run.wait_healthy(launcher, port, run.boot_budget(mode, language))
        answers = capture("127.0.0.1:%d" % port)
    finally:
        launcher.stop()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(answers, sort_keys=True))
    return answers


def agree(captures, everyone=None):
    """The expectation, and everything the contributors did not agree on.

    A request every contributor answered the same way becomes an expectation. A request
    they answered differently becomes a disagreement, and nothing is written for it: one of
    them is wrong and this file cannot say which.
    """
    everyone = everyone or captures
    expected, disagreements, partial, unpinned = {}, [], [], {}
    per_target = {n: {} for n in sorted(everyone)}
    names = sorted(captures)
    for ep in PLAN["endpoints"]:
        for key in keys_of(ep):
            answers = {n: captures[n][key] for n in names if key in captures[n]}
            if len(answers) < len(names):
                partial.append(key)
                continue
            # An error body is the framework's own shape, so it is recorded per target
            # rather than agreed between them. What every target still owes is the status,
            # a non-empty JSON body, and the field errors the shared validator produced.
            if is_error(ep):
                for name in sorted(everyone):
                    answer = everyone[name].get(key)
                    if answer is not None:
                        per_target[name][key] = envelope(answer)
                continue
            first = answers[names[0]]
            odd = [n for n in names[1:] if answers[n] != first]
            if not odd:
                expected[key] = first
                continue
            # Whether a framework bothers to compress a body too small to benefit is a
            # property of the framework, and compressed.gzip_small is in the endpoint set
            # to show it. So a disagreement about content-encoding alone is not an error:
            # it is recorded as unpinned, with what each target answered, and the field
            # goes unchecked for that request. Every other field still has to agree, and a
            # disagreement anywhere else still blocks the file.
            if all(differs_only_on("encoding", first, answers[n]) for n in odd):
                unpinned[key] = {n: answers[n]["encoding"] or "identity" for n in names}
                expected[key] = {**first, "encoding": None}
                continue
            # A 304 carries no body, and RFC 9110 15.4.5 leaves what else it carries to the
            # sender: @fastify/etag keeps the content-type its route declared and Django's
            # ConditionalGetMiddleware drops it. Neither is wrong, and which one a framework
            # does is a property worth recording rather than a difference worth failing on.
            if NO_BODY_STATUS.issuperset({a["status"] for a in answers.values()}) \
                    and all(differs_only_on("body_class", first, answers[n]) for n in odd):
                unpinned[key] = {n: answers[n]["body_class"] for n in names}
                expected[key] = {**first, "body_class": None}
                continue
            disagreements.append((key, odd, answers))
    return expected, disagreements, partial, unpinned, per_target


#: Statuses that carry no body, where the headers around it are the sender's choice.
NO_BODY_STATUS = {204, 304}


def differs_only_on(field, a, b):
    return {k: v for k, v in a.items() if k != field} == \
           {k: v for k, v in b.items() if k != field}


def document(expected, contributors, unpinned, per_target):
    return {
        "version": EXPECTED_VERSION,
        "blend": PLAN["version"],
        # Requests where one field is deliberately not an expectation, and what each
        # contributor answered there. Anything listed here is a framework property the
        # endpoint set exists to show rather than a behaviour every target owes.
        "unpinned": dict(sorted(unpinned.items())),
        # The expectation is only meaningful for the plan and fixture it was taken
        # against. A regenerated fixture changes every body, and a stale expectation would
        # then fail every target for a reason that has nothing to do with any of them.
        "plan": digest("plan.json"),
        "fixture": digest("fixture.json"),
        "agreed_by": sorted(contributors),
        # What an endpoint answering 400 or above must satisfy whatever its envelope: the
        # status, a non-empty JSON body, and these field errors found wherever it put them.
        "errors": {
            ep["id"]: {
                "statuses": sorted(set(ep.get("accepts") or [ep["expect"]])),
                "field_errors": [list(pair) for pair in ep.get("field_errors", [])],
            }
            for ep in PLAN["endpoints"] if is_error(ep)
        },
        "requests": dict(sorted(expected.items())),
        # The shape of the error body each target answered with: every key path and the
        # type at it, values dropped. Not a contract between targets -- it is how a
        # target's own envelope is held still, so a change to it is caught without
        # twenty-eight of them being made to share one.
        "targets": {name: dict(sorted(rows.items()))
                    for name, rows in sorted(per_target.items()) if rows},
    }


def stale_against_spec():
    """Whether the committed file describes the plan and fixture now on disk."""
    if not OUT.exists():
        return "spec/expected.json does not exist"
    doc = json.loads(OUT.read_text())
    for name in ("plan", "fixture"):
        if doc.get(name) != digest(name + ".json"):
            return "spec/expected.json was taken against a different spec/%s.json" % name
    if doc.get("blend") != PLAN["version"]:
        return "spec/expected.json is %s, the plan is %s" % (doc.get("blend"), PLAN["version"])
    return None


def load():
    """The committed expectation, or a clear reason it cannot be used."""
    why = stale_against_spec()
    if why:
        raise SystemExit(why + "; run 'make expected'")
    return json.loads(OUT.read_text())


def shape(answer):
    """A disagreement's signature, short enough to read and specific enough to act on.

    The body goes in as a digest rather than as itself: two targets disagreeing about a
    1425-item payload disagree about one field, and printing both copies buries it.
    """
    body = json.dumps(answer["body"], sort_keys=True)
    return "%s %s %s body:%s" % (answer["status"], answer["body_class"],
                                 answer.get("encoding") or "identity",
                                 hashlib.sha256(body.encode()).hexdigest()[:8])


def report_disagreements(disagreements):
    """One line per distinct disagreement, not per request.

    domain.delete has 512 instances and every one of them disagreed the same way. Listing
    them individually reported one bug 512 times and pushed the other bugs off the screen.
    """
    groups = collections.OrderedDict()
    for key, _, answers in disagreements:
        eid = key.split(" ", 1)[0]
        sides = collections.OrderedDict()
        for name, ans in answers.items():
            sides.setdefault(shape(ans), []).append(name)
        signature = (eid, tuple((sig, tuple(who)) for sig, who in sides.items()))
        groups.setdefault(signature, []).append(key)

    print("\n%d request(s) the targets do not agree on, in %d distinct disagreement(s):"
          % (len(disagreements), len(groups)))
    for (eid, sides), keys in groups.items():
        print("\n  %s  (%d request%s, e.g. %s)"
              % (eid, len(keys), "" if len(keys) == 1 else "s", keys[0].split(" ", 1)[1]))
        for sig, who in sides:
            print("    %-34s %s" % (",".join(who), sig))
    print("\nNothing was written. Decide each of these against spec/endpoints.json, fix the")
    print("targets that are wrong, and run this again.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--targets", default="",
                    help="language:target,... to derive from. Default: one per language")
    ap.add_argument("--mode", choices=["local", "docker"], default="local")
    ap.add_argument("--write", action="store_true", help="write spec/expected.json")
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero unless the committed file is what they answer now")
    ap.add_argument("--cached", action="store_true",
                    help="reuse results/captures/ instead of booting anything")
    ap.add_argument("--record", default="",
                    help="language:target,... whose error envelopes are recorded. Default: "
                         "every implemented target, because an envelope nobody recorded is "
                         "an envelope that can change without anyone noticing")
    a = ap.parse_args()

    named = [t for t in a.targets.split(",") if t.strip()]
    if not named:
        named = list(DEFAULT_CONTRIBUTORS)
    if len(named) < 2:
        sys.exit("at least two independent targets are needed; agreement between one "
                 "target and itself is not evidence of anything")

    recorded = [t for t in a.record.split(",") if t.strip()]
    if not recorded:
        recorded = ["%s:%s" % p for p in bundle.implemented()]
    # The contributors decide what a 2xx answer is. Every target's error envelope is
    # recorded, because an envelope is the framework's own and holding it still is the only
    # way a change to it is noticed.
    order = named + [t for t in recorded if t not in named]

    print("deriving the expectation from %d targets, recording error envelopes from %d, "
          "mode=%s" % (len(named), len(order), a.mode))
    captures = {}
    # One port per target, from a block claimed for this derivation, the way a run claims
    # one. Contributors boot one at a time here too, so this is isolation from whatever
    # else is on the machine rather than room to boot them together.
    base = run.claim_ports(max(run.PORT_BLOCK, len(order)))
    for n, entry in enumerate(order):
        language, _, target = entry.partition(":")
        print("  %-24s booting" % entry, end="", flush=True)
        captures[entry] = boot_and_capture(language, target, a.mode, base + n, a.cached)
        reached = sum(1 for v in captures[entry].values() if v["status"])
        print("\r  %-24s %d/%d requests answered" % (entry, reached, len(captures[entry])))

    expected, disagreements, partial, unpinned, per_target = agree(
        {n: captures[n] for n in named}, captures)
    print("\n%d/%d requests agreed by all %d targets"
          % (len(expected), sum(len(keys_of(e)) for e in PLAN["endpoints"]), len(named)))
    if partial:
        print("  %d request(s) some target never answered at all" % len(partial))
    errors_recorded = sum(len(rows) for rows in per_target.values())
    if errors_recorded:
        print("  %d error response(s) recorded per target; their envelopes are not shared"
              % errors_recorded)
    if disagreements:
        report_disagreements(disagreements)
        return 1

    if unpinned:
        print("\n%d request(s) with one field left unpinned:" % len(unpinned))
        for key, who in sorted(unpinned.items()):
            print("  %-40s %s" % (
                key, ", ".join("%s=%s" % (n, v) for n, v in sorted(who.items()))))
    doc = document(expected, named, unpinned, per_target)
    if a.check:
        if not OUT.exists():
            print("spec/expected.json does not exist")
            return 1
        current = json.loads(OUT.read_text())
        if current.get("requests") != doc["requests"]:
            print("the committed expectation is not what these targets answer now")
            return 1
        print("the committed expectation matches")
        return 0
    if a.write:
        OUT.write_text(json.dumps(doc, indent=1, sort_keys=False) + "\n")
        print("wrote %s (%d requests, %.1f KB)"
              % (OUT, len(expected), OUT.stat().st_size / 1024))
        return 0
    print("nothing written; pass --write or --check")
    return 0


if __name__ == "__main__":
    sys.exit(main())
