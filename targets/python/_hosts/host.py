"""What every Python target needs from the host: the port to bind, what to answer on
/__meta, and the one template engine they all render with.

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

from jinja2 import Environment


def dist_version(name):
    """The version pip resolved for a distribution, or empty when it is not installed."""
    try:
        return version(name)
    except PackageNotFoundError:
        return ""


def runtime():
    return "%s %s" % (platform.python_implementation().lower(), platform.python_version())


def meta(framework, dist=None, adapter=""):
    """What a target answers on /__meta. Outside the blend spec on purpose: it is not
    measured and not conformance-checked, it exists so a point on the results chart can be
    attributed to a framework version rather than to a different runner.

    `template` is the engine the template family renders with, which every Python target
    shares for the same reason the gzip level is pinned.
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
        "template": "jinja2 " + dist_version("jinja2"),
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


# ---- template ------------------------------------------------------------------------
#
# The same markup as every other language's items template. The spec pins content and
# leaves whitespace free, because the engines cannot agree on formatting without every
# template being contorted to match.
ITEMS = """<!doctype html>
<html>
  <head><title>items</title></head>
  <body>
    <h1>{{ size }}</h1>
    <table>
      <thead>
        <tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr>
      </thead>
      <tbody>
        {% for it in items %}
        <tr>
          <td>{{ it.id }}</td>
          <td>{{ it.name }}</td>
          <td>{{ it.category }}</td>
          <td>{{ it.price_cents }}</td>
          <td>{% if it.in_stock %}yes{% else %}no{% endif %}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    <p>{{ count }} rows</p>
  </body>
</html>"""

_TEMPLATE = Environment(autoescape=True).from_string(ITEMS)


def render_items(body):
    """Renders the items table. Parsed once and rendered per request, which is what the
    other languages do: a precomputed string would measure nothing."""
    return _TEMPLATE.render(size=body["size"], count=body["count"], items=body["items"])
