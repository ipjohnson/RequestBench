"""What every Python target needs from the host: the port to bind and what to answer on
/__meta.

Only the container contract is implemented. That is Cloud Run's contract and therefore
covers Fargate, ECS and plain Docker unchanged; the function hosts are not wired yet.

Python is the first language here where the framework is not the server. Five of the six
ship none, so each target names the server its own framework's documentation reaches for
first, and /__meta records it as the adapter -- the same field Node uses for what sits
between the host and the framework. A step in a target's numbers with the framework
version unchanged is otherwise unexplained.
"""
import time

# Where boot_ms counts from. container.py imports this module before it loads the target,
# so the clock starts before the framework is imported. The interpreter's own start comes
# before any Python code runs and is not counted.
STARTED = time.monotonic()

import os
import platform
import sys
from importlib.metadata import PackageNotFoundError, version

# The one dict every target answers /__meta with. listening() adds boot_ms to it, which is
# why a target returns what meta() gave it rather than a copy.
_meta = {}


def dist_version(name):
    """The version pip resolved for a distribution, or empty when it is not installed."""
    try:
        return version(name)
    except PackageNotFoundError:
        return ""


def runtime():
    return "%s %s" % (platform.python_implementation().lower(), platform.python_version())


def meta(framework, dist=None, adapter="", template="", etag="", cache=""):
    """What a target answers on /__meta. Outside the blend spec on purpose: it is not
    measured and not conformance-checked, it exists so a point on the results chart can be
    attributed to a framework version rather than to a different runner.

    `template` is the engine this target renders the template family with. Each target
    passes its own, because each reaches an engine through its own framework's view
    facility and two targets in one language need not agree on which.

    `etag` and `cache` say the same thing about the two caching families: which digest
    computed the validator, and what stored the response. Both are the framework's own
    facility where it ships one, so the rows are read against the declaration rather than
    across targets that are not doing the same thing.
    """
    server = adapter
    if adapter:
        v = dist_version(adapter)
        if v:
            server = "%s %s" % (adapter, v)
    _meta.update({
        "framework": framework,
        "version": dist_version(dist or framework),
        "runtime": runtime(),
        "adapter": server,
        "template": template,
        "etag": etag,
        "cache": cache,
    })
    return _meta


def listening():
    """Called by the target's server once it is ready to accept. Each of the four servers
    has its own hook for that moment, so each target wires this to its own."""
    _meta["boot_ms"] = round((time.monotonic() - STARTED) * 1000, 1)


def run_uvicorn(app, **options):
    """uvicorn.run(app, **options), calling listening() once uvicorn has bound.

    uvicorn.run takes no callback, and the ASGI lifespan startup runs before uvicorn binds,
    so the moment is only reachable from Server.startup.
    """
    import uvicorn

    class Server(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets)
            if self.started:
                listening()

    Server(uvicorn.Config(app, **options)).run()


def port():
    return int(os.environ.get("PORT", "8080"))


def boot(framework):
    """The port to bind, announced. The fixture is already loaded: _shared.domain reads it
    at import, because a target's routes close over it while the module is still
    executing."""
    p = port()
    print("container/%s listening on %d" % (framework, p), file=sys.stderr, flush=True)
    return p
