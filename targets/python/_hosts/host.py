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
import os
import platform
import sys
from importlib.metadata import PackageNotFoundError, version


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
    return {
        "framework": framework,
        "version": dist_version(dist or framework),
        "runtime": runtime(),
        "adapter": server,
        "template": template,
        "etag": etag,
        "cache": cache,
    }


def port():
    return int(os.environ.get("PORT", "8080"))


def boot(framework):
    """The port to bind, announced. The fixture is already loaded: _shared.domain reads it
    at import, because a target's routes close over it while the module is still
    executing."""
    p = port()
    print("container/%s listening on %d" % (framework, p), file=sys.stderr, flush=True)
    return p
