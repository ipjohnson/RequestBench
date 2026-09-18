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
"""
import functools
import json
import pathlib
from dataclasses import dataclass

# The test runs from somewhere under the repository, and the root is where spec/ is.
ROOT = next(p for p in pathlib.Path(__file__).resolve().parents
            if (p / "spec" / "expected.json").exists())


@functools.cache
def _read(name):
    return json.loads((ROOT / "spec" / name).read_text())


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
    if ep.get("body") is not None:
        headers["content-type"] = "application/json"
    key = "%s %s" % (endpoint_id, path)
    error = endpoint_id in _read("expected.json")["errors"]
    return Ask(endpoint_id, key, ep["method"], path, headers, ep.get("body"),
               None if error else _read("expected.json")["requests"][key])


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
