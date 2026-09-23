from pathlib import Path

from sanic import Sanic

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


def build(p: Payloads) -> Sanic:
    """The application, as each worker builds it and as the suite does.

    Each family is a Blueprint of its own. The errors family has no routes: its answers are the
    router's, the body parser's and the items handlers'.
    """
    app = Sanic("RequestBench")
    app.config.update({
        # sanic-ext serves the OpenAPI document and two pages about it under /docs by default. The
        # corpus asks for none of them. Client/document.py turns them back on to write the document.
        "OAS": False,
        "TEMPLATING_PATH_TO_TEMPLATES": Path(__file__).parent / "templates",
    })
    for family in (baseline, json, parameters, query, headers, body, authorized, items, cache, compressed, etag, cors,
                   forms, stream, sse, template, contract):
        app.blueprint(family.blueprint(p))
    for layered in middleware.blueprints(p):
        app.blueprint(layered)
    # rb:handler static.file
    # rb:wiring static.*
    app.static("/static", p.directory)
    return app
