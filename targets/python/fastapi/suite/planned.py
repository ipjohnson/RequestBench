# rb:test *
"""What a correct answer is, and which request asks for it.

Both come out of spec/. spec/expected.json is the only authority on a correct answer and the
conformance client is the only thing that judges a target against it, so a suite that passes
while `make test` fails this target is the suite that is wrong, and writing a status or a body
into a test as a literal is how the two drift apart. spec/plan.json is where an order id, a
query string and a request body come from, and a test that typed one out would be asserting
against a request the measurement never sends.

Instance zero, always. An endpoint sends up to 512 requests and the conformance client replays
every one; a suite sends one, so it has to be the same one on every run or a failure would not
reproduce.

A value drawn once per run is the exception. No committed file may hold one, because a target
could read it there, so a suite draws its own once per process. Each goes wherever the plan or
the pinned answer carries its {run.<name>}.
"""
import functools
import json
import pathlib
import random
import re
import urllib.parse
from dataclasses import dataclass

# The test runs from somewhere under the repository, and the root is where spec/ is.
ROOT = next(p for p in pathlib.Path(__file__).resolve().parents
            if (p / "spec" / "expected.json").exists())
RUN = re.compile(r"\{run\.([a-z_]+)\}")


@functools.cache
def _read(name):
    return json.loads((ROOT / "spec" / name).read_text())


@functools.cache
def _values():
    """This process's value for each declaration in the plan's run_values.

    SystemRandom rather than a fixed seed, because a target could compute the values from a
    seed written here.
    """
    rng = random.SystemRandom()

    def text(length, chars):
        return "".join(rng.choice(chars) for _ in range(length))

    out = {}
    for name, rule in _read("plan.json")["run_values"].items():
        if rule["kind"] == "int":
            out[name] = rng.randint(10 ** (rule["digits"] - 1), 10 ** rule["digits"] - 1)
        elif rule["kind"] == "string":
            out[name] = text(rule["length"], rule["chars"])
        elif rule["kind"] == "words":
            out[name] = " ".join(text(rule["length"], rule["chars"])
                                 for _ in range(rule["count"]))
        else:
            out[name] = rng.choice(rule["values"])
    return out


def _in_path(path):
    """A path from the plan with this process's values in it, percent-encoded.

    A space goes as %20 and never as +, because RFC 3986 does not read + as a space.
    """
    return RUN.sub(lambda m: urllib.parse.quote(str(_values()[m.group(1)]), safe=""), path)


def _in_header(value):
    """A header value from the plan with this process's values in it, not encoded."""
    return RUN.sub(lambda m: str(_values()[m.group(1)]), value)


def _filled(body):
    """A pinned body with each string that is exactly a placeholder replaced by its value.

    spec/expected.json holds every placeholder as a string. An int goes back in as the number
    it is.
    """
    if isinstance(body, str):
        m = RUN.fullmatch(body)
        return _values()[m.group(1)] if m else body
    if isinstance(body, list):
        return [_filled(v) for v in body]
    if isinstance(body, dict):
        return {k: _filled(v) for k, v in body.items()}
    return body


@dataclass(frozen=True)
class Ask:
    id: str
    key: str
    method: str
    path: str
    headers: dict
    body: str | None
    # None for an error endpoint: its envelope is the framework's own contract, and
    # envelope.py rather than floor.py is what judges it.
    want: dict | None


def ask(endpoint_id):
    """One of an endpoint's requests, and the answer pinned for it."""
    ep = next(e for e in _read("plan.json")["endpoints"] if e["id"] == endpoint_id)
    path = ep["paths"][0]
    headers = dict(ep.get("headers") or {})
    # A vary row sends a different header set per instance, which is what the response cache
    # is keyed on. Instance zero, for the reason above.
    if ep.get("header_variants"):
        headers.update(ep["header_variants"][0])
    headers = {k: _in_header(v) for k, v in headers.items()}
    if ep.get("body") is not None:
        headers["content-type"] = "application/json"
    # spec/expected.json is keyed by the path as the plan writes it. The one that is sent
    # changes every run.
    key = "%s %s" % (endpoint_id, path)
    want = None
    if endpoint_id not in _read("expected.json")["errors"]:
        pinned = _read("expected.json")["requests"][key]
        want = dict(pinned, body=_filled(pinned["body"]))
    return Ask(endpoint_id, key, ep["method"], _in_path(path), headers, ep.get("body"), want)


def capture_for(a):
    """The request a validator is taken from, for the one endpoint that needs one first.

    etag.match_large carries {capture.etag_large} in its if-none-match, which only the target
    can produce, so nothing can send it until the target has answered a different request.
    """
    for value in a.headers.values():
        if value.startswith("{capture."):
            spec = _read("plan.json")["captures"][value[len("{capture."):-1]]
            return spec["method"], spec["path"], spec["header"]
    return None


def resolved(a, captured):
    """The same headers with the capture's placeholder replaced by what was captured."""
    return {k: captured if v.startswith("{capture.") else v for k, v in a.headers.items()}


def envelope(target, key):
    """The error envelope this target recorded, as status, body class and shape."""
    return _read("expected.json")["targets"].get(target, {}).get(key)
# rb:end
