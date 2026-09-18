# rb:test *
"""The target, driven by Flask's own test client.

app.test_client() is Werkzeug's, and it ships with the framework: nothing to install beyond
pytest. The fixtures are the ones Flask's testing documentation writes, TESTING included, and
TESTING is not inert: it propagates an unhandled exception into the test rather than
answering 500 with it.

No server and no socket: the client calls the WSGI application directly. Flask has no
route-scoped middleware, so the compressed family's codec is an after_request hook on its own
blueprint, which runs inside the application and is reached. Werkzeug's client does not
decode gzip either, so get_data() is already the bytes as they were sent, which is the one
thing this suite gets for free that the three httpx-based ones had to ask for.
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
    target.app.config.update({"TESTING": True})
    yield target.app


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def send(client):
    """Send one of an endpoint's planned requests."""
    def send(a, headers=None):
        r = client.open(a.path, method=a.method, headers=headers or a.headers, data=a.body)
        return Answer(r.status_code, r.headers.get("content-type", ""),
                      r.headers.get("content-encoding", ""), r.get_data(), r.headers)
    return send


@pytest.fixture(scope="session")
def send_after_capture(client, send):
    """Ask for the validator first, then send the request that carries it."""
    def send_after_capture(a):
        method, path, header = planned.capture_for(a)
        captured = client.open(path, method=method).headers.get(header, "")
        return send(a, planned.resolved(a, captured))
    return send_after_capture
# rb:end
