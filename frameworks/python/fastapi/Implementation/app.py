from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

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


def build(p: Payloads) -> FastAPI:
    """The application, as each uvicorn worker builds it and as the suite does.

    Each family is an APIRouter of its own. Starlette matches routes in the order they were added,
    so the two families most rows are read against come first. The errors family has no routes:
    its answers are the router's, the body parser's and the items handlers'.
    """
    # The documentation routes are off. They are three more routes ahead of every other, and the
    # corpus asks for none of them.
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    for family in (baseline, json, middleware, parameters, query, headers, body, authorized, items, cache, etag, forms, stream, sse, template, contract):
        app.include_router(family.router(p))
    # FastAPI has no middleware on a route or a router. A mounted sub-application is how it
    # scopes one, so these two families are sub-applications with a middleware each.
    app.mount("/compressed", compressed.application(p))
    app.mount("/cors", cors.application(p))
    # rb:handler static.file
    # rb:wiring static.*
    app.mount("/static", StaticFiles(directory=p.directory))
    return app
