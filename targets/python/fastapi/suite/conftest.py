# rb:test *
"""The target, booted in process by FastAPI's TestClient.

FastAPI's TestClient is Starlette's, and at the pinned Starlette it wants httpx2: it imports
httpx2 first, falls back to httpx with a deprecation warning, and its own error message says
`pip install httpx2`. FastAPI's testing documentation still says to install httpx. The suite
installs what the client it runs asks for.

No server and no socket: the client calls the ASGI application directly, so middleware still
runs. GZipMiddleware on the mounted /compressed sub-application is ASGI middleware, which is
why the compressed family can be tested this way here at all.
"""
import os
import pathlib
import sys

import pytest

import planned

TARGET = pathlib.Path(__file__).resolve().parent.parent
# The target imports _hosts and _shared from targets/python, and is itself a module called
# app beside five others of the same name, so each suite runs on its own.
sys.path[:0] = [str(TARGET), str(TARGET.parent)]
# app.py reads the fixture at import, through a relative fallback that resolves against the
# directory harness/run.py starts a target in. A test runs from somewhere else.
os.environ["RB_FIXTURE"] = str(planned.ROOT / "spec" / "fixture.json")

from fastapi.testclient import TestClient  # noqa: E402

import app as target  # noqa: E402
from floor import Answer  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(target.app) as c:
        yield c


@pytest.fixture(scope="session")
def send(client):
    """Send one of an endpoint's planned requests and keep the bytes as they were sent.

    The trap this family is built to catch is the client, not the host. httpx decodes gzip
    before .content ever sees it, so a test reading .content would pass every gzip assertion
    against an identity response. iter_raw() is the undecoded stream.
    """
    def send(a, headers=None):
        with client.stream(a.method, a.path, headers=headers or a.headers,
                           content=a.body) as r:
            raw = b"".join(r.iter_raw())
        return Answer(r.status_code, r.headers.get("content-type", ""),
                      r.headers.get("content-encoding", ""), raw, r.headers)
    return send


@pytest.fixture(scope="session")
def send_after_capture(client, send):
    """Ask for the validator first, then send the request that carries it."""
    def send_after_capture(a):
        method, path, header = planned.capture_for(a)
        captured = client.request(method, path).headers.get(header, "")
        return send(a, planned.resolved(a, captured))
    return send_after_capture
# rb:end
