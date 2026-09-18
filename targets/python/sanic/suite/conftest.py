# rb:test *
"""The target, driven by sanic-testing's test client, over a real socket.

sanic-testing is Sanic's own package and app.test_client is what its documentation reaches
for first. It is not in-process in the sense the other five suites are: every request starts
the application on a random loopback port with app.run(), sends one request over httpx, and
stops it again. So this is the one Python suite whose recommended path already crosses a
socket, and it pays a server boot per request for it.

Its newest release is 24.6.0 against a pinned Sanic of 25.12.1. It declares no bound on Sanic
and it works, which is a thing a suite has to find out rather than read.

The compressed family's codec is an on_response middleware on its own blueprint, which is
inside the application and would be reached even without the socket.
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

import app as target  # noqa: E402
from floor import Answer  # noqa: E402


@pytest.fixture(scope="session")
def app():
    return target.app


@pytest.fixture(scope="session")
def send(app):
    """Send one of an endpoint's planned requests."""
    def send(a, headers=None):
        _, r = app.test_client.request(a.path, http_method=a.method,
                                       headers=headers or a.headers, content=a.body)
        return Answer(r.status_code, r.headers.get("content-type", ""),
                      r.headers.get("content-encoding", ""), r.content, r.headers)
    return send


@pytest.fixture(scope="session")
def send_after_capture(app, send):
    """Ask for the validator first, then send the request that carries it."""
    def send_after_capture(a):
        method, path, header = planned.capture_for(a)
        _, first = app.test_client.request(path, http_method=method)
        return send(a, planned.resolved(a, first.headers.get(header, "")))
    return send_after_capture
# rb:end
