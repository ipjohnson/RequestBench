from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles

from payloads import Payloads
from routes import (
    authorized,
    baseline,
    body,
    cache,
    compressed,
    contract,
    cors,
    etag,
    forms,
    headers,
    items,
    json,
    middleware,
    parameters,
    query,
    sse,
    stream,
    template,
)


def build(p: Payloads) -> Starlette:
    """The application, as each uvicorn worker builds it and as the suite does.

    Each family gives its own routes. Starlette's router tries routes in the order they were added,
    so the two families most rows are read against come first. The errors family has no routes:
    its answers are the router's, SpecTree's and the items endpoint's.
    """
    families = (baseline, json, middleware, parameters, query, headers, body, authorized, items, cache, etag,
                compressed, cors, forms, stream, sse, template, contract)
    routes = [route for family in families for route in family.routes(p)]
    # rb:handler static.file
    # rb:wiring static.*
    routes.append(Mount("/static", app=StaticFiles(directory=p.directory)))
    return Starlette(routes=routes)
