# rb:test *
"""The target, booted in process by Litestar's own TestClient.

litestar.testing ships with the framework, and its TestClient is built on httpx rather than
the httpx2 Starlette's has moved to, so the two ASGI frameworks here that each ship a test
client ask for different transports.

No server and no socket: the client calls the ASGI application directly. Litestar's
compression is its own CompressionMiddleware, scoped to the compressed routes with
DefineMiddleware, and it runs in the request path like any other ASGI middleware, so an
in-process client reaches the codec.
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

from litestar.testing import TestClient  # noqa: E402

import app as target  # noqa: E402
from floor import Answer  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app=target.app) as c:
        yield c


@pytest.fixture(scope="session")
def send(client):
    """Send one of an endpoint's planned requests and keep the bytes as they were sent.

    httpx decodes gzip before .content ever sees it, so a test reading .content would pass
    every gzip assertion against an identity response. iter_raw() is the undecoded stream.
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
