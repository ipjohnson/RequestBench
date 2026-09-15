"""What every target must answer, decided once and committed.

  python3 harness/expected.py --write            # boot the agreeing targets, write spec/expected.json
  python3 harness/expected.py --check            # is the committed file still what they agree on

Until now a target was gated against another target booted minutes earlier in the same
run. Agreement between two frameworks is evidence that they are consistent; it is not
evidence that either is right, and nothing in the repository said what the right answer
was. This produces that statement.

It is derived rather than hand-written, because forty-five endpoints against a 3,346-entry
plan is not a file anyone can author correctly. The derivation is only trustworthy because
of what it insists on: every contributing target must answer identically, and they are
independent implementations in four languages against four different HTTP stacks. A value
only one of them produces is not written, it is reported as a disagreement and resolved
against spec/endpoints.json by hand before this runs again.

Once written the file is the authority. A target that disagrees with it is wrong, however
many other targets share the mistake, and changing it is a deliberate edit with a reason,
not a side effect of rerunning a generator.
"""
import argparse
import collections
import hashlib
import http.client
import json
import pathlib
import sys

import conform
import run

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "spec"
PLAN = json.loads((SPEC / "plan.json").read_text())
OUT = SPEC / "expected.json"

EXPECTED_VERSION = "expected-v1"

# Four languages, four HTTP stacks, four independent implementations. Deriving from all
# twenty-eight would make the expectation a vote rather than an agreement, and a mistake
# shared by a whole language would carry it.
DEFAULT_CONTRIBUTORS = ("node:fastify", "go:gin", "rust:axum", "python:fastapi")

# Every distinct request in the plan, as one key. The instances of an endpoint are
# different requests -- /domain/orders/602 and /domain/orders/876 return different orders
# -- so one expectation per endpoint could only ever describe the first of them.
def keys_of(ep):
    return [(ep["id"] + " " + p) for p in dict.fromkeys(ep["paths"])]


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


def capture(hostport):
    """Replay the plan against a running target and return what it answered.

    One entry per distinct request: the status, the kind of body, and the body as a value
    rather than as bytes. Key order and number formatting follow whatever the language's
    serializer does and mean nothing, so comparing parsed values is what keeps a real
    disagreement legible instead of two digests that do not match.
    """
    host, _, port = hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port or 80), timeout=20)
    out = {}
    for ep in PLAN["endpoints"]:
        body = ep.get("body")
        headers = dict(ep.get("headers") or {})
        if body:
            headers["content-type"] = "application/json"
        for path in dict.fromkeys(ep["paths"]):
            key = ep["id"] + " " + path
            try:
                conn.request(ep["method"], path, body=body, headers=headers)
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
                "body": conform.comparable(conform.decoded(raw, hdrs), ctype),
            }
    conn.close()
    return out


CACHE = ROOT / "results" / "captures"


def cache_path(language, target, mode):
    return CACHE / ("%s-%s.%s.json" % (language, target, mode))


def boot_and_capture(language, target, mode, cached=False):
    """Start the target the way a measurement would, wait for it to answer, replay.

    The capture is written beside the run so a second look at what a target answered costs
    nothing. Deriving the expectation is a read of four captures; rebooting four containers
    to reread them is how a person stops rerunning it.
    """
    out = cache_path(language, target, mode)
    if cached and out.exists():
        return json.loads(out.read_text())
    launcher = run.launcher(mode, language, target)
    launcher.start()
    try:
        run.wait_healthy(launcher, 240 if (mode == "local" and language in ("go", "rust"))
                         else run.LADDER["boot_timeout_s"][run.warmup_class(language)])
        answers = capture("127.0.0.1:%d" % run.PORT)
    finally:
        launcher.stop()
        run.wait_port_free(run.PORT, 20)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(answers, sort_keys=True))
    return answers


def agree(captures):
    """The expectation, and everything the contributors did not agree on.

    A request every contributor answered the same way becomes an expectation. A request
    they answered differently becomes a disagreement, and nothing is written for it: one of
    them is wrong and this file cannot say which.
    """
    expected, disagreements, partial, unpinned = {}, [], [], {}
    names = sorted(captures)
    for ep in PLAN["endpoints"]:
        for key in keys_of(ep):
            answers = {n: captures[n][key] for n in names if key in captures[n]}
            if len(answers) < len(names):
                partial.append(key)
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
            if all(differs_only_on_encoding(first, answers[n]) for n in odd):
                unpinned[key] = {n: answers[n]["encoding"] or "identity" for n in names}
                expected[key] = {**first, "encoding": None}
                continue
            disagreements.append((key, odd, answers))
    return expected, disagreements, partial, unpinned


def differs_only_on_encoding(a, b):
    return {k: v for k, v in a.items() if k != "encoding"} == \
           {k: v for k, v in b.items() if k != "encoding"}


def document(expected, contributors, unpinned):
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
        "requests": dict(sorted(expected.items())),
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
    a = ap.parse_args()

    named = [t for t in a.targets.split(",") if t.strip()]
    if not named:
        named = list(DEFAULT_CONTRIBUTORS)
    if len(named) < 2:
        sys.exit("at least two independent targets are needed; agreement between one "
                 "target and itself is not evidence of anything")

    print("deriving the expectation from %d targets, mode=%s" % (len(named), a.mode))
    captures = {}
    for entry in named:
        language, _, target = entry.partition(":")
        print("  %-24s booting" % entry, end="", flush=True)
        captures[entry] = boot_and_capture(language, target, a.mode, a.cached)
        reached = sum(1 for v in captures[entry].values() if v["status"])
        print("\r  %-24s %d/%d requests answered" % (entry, reached, len(captures[entry])))

    expected, disagreements, partial, unpinned = agree(captures)
    print("\n%d/%d requests agreed by all %d targets"
          % (len(expected), sum(len(keys_of(e)) for e in PLAN["endpoints"]), len(named)))
    if partial:
        print("  %d request(s) some target never answered at all" % len(partial))
    if disagreements:
        report_disagreements(disagreements)
        return 1

    if unpinned:
        print("\n%d request(s) with one field left unpinned:" % len(unpinned))
        for key, who in sorted(unpinned.items()):
            print("  %-40s content-encoding: %s" % (
                key, ", ".join("%s=%s" % (n, v) for n, v in sorted(who.items()))))
    doc = document(expected, named, unpinned)
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
