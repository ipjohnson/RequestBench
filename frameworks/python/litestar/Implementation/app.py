from litestar import Litestar
from litestar.config.response_cache import ResponseCacheConfig
from litestar.openapi import OpenAPIConfig
from litestar.static_files import create_static_files_router

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


def build(p: Payloads, openapi_config: OpenAPIConfig | None = None) -> Litestar:
    """The application, as each uvicorn worker builds it and as the suite does.

    Each family is a Router of its own, and a family's middleware sits on its Router. The errors
    family has no routes: its answers are the router's, the body parser's and the items handlers'.
    Litestar's router is a trie, so the order the families are given in decides nothing.

    openapi_config is None, so the application serves no documentation routes. Client/document.py
    passes a config to build the OpenAPI document, which adds those routes and changes no other.
    """
    return Litestar(
        route_handlers=[family.router(p) for family in (
            baseline, json, middleware, parameters, query, headers, body, authorized, items, cache, compressed, etag,
            cors, forms, stream, sse, template, contract,
        )] + [
            # rb:handler static.file
            # rb:wiring static.*
            create_static_files_router(path="/static", directories=[p.directory]),
        ],
        cors_config=cors.config(p),
        # rb:wiring cache.*
        # Each cached route expires its answers after ttlSeconds. The store is the application's
        # default MemoryStore, one in each worker, which holds every key it is given until each
        # expires, so settings.json's capacity has nothing to set.
        response_cache_config=ResponseCacheConfig(default_expiration=p.settings.cache.ttl_seconds),
        template_config=template.CONFIG,
        openapi_config=openapi_config,
    )
