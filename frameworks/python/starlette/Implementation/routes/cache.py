from collections.abc import Awaitable, Callable
from functools import wraps

# rb:wiring cache.*
from cachetools import TTLCache
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from serial import fresh

type Endpoint = Callable[[Request], Awaitable[Response]]


def routes(p: Payloads) -> list[BaseRoute]:
    """cache: the endpoint skipped and a stored answer written back. The endpoint writes x-rb-serial,
    so a replayed answer repeats the serial it was stored with."""
    settings = p.settings["cache"]
    one = tuple(settings["vary"]["one"])
    many = tuple(settings["vary"]["many"])

    # rb:wiring cache.*
    # Each worker holds a store of its own, sized in entries by settings.json.
    store: TTLCache = TTLCache(maxsize=settings["capacity"], ttl=settings["ttlSeconds"])

    def replayed(on: tuple[str, ...] = ()) -> Callable[[Endpoint], Endpoint]:
        """Starlette ships no response cache, so this is wired by hand, as a decorator on the
        endpoint. It answers from the store before the endpoint runs, and stores the response the
        endpoint returned. The key is the path and query, and the request headers the route varies
        on."""

        def decorate(endpoint: Endpoint) -> Endpoint:
            @wraps(endpoint)
            async def replay(request: Request) -> Response:
                key = (request.url.path, request.url.query, *(request.headers.get(name, "") for name in on))
                stored = store.get(key)
                if stored is not None:
                    return stored
                response = await endpoint(request)
                if response.status_code == 200:
                    store[key] = response
                return response

            return replay

        return decorate
    # rb:end

    # rb:handler cache.small
    @replayed()
    async def small(request: Request) -> Response:
        """
        responses:
          200: {description: items.small from the store after the first request, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.small)

    # rb:handler cache.medium
    @replayed()
    async def medium(request: Request) -> Response:
        """
        responses:
          200: {description: items.medium from the store after the first request, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.medium)

    # rb:handler cache.large
    @replayed()
    async def large(request: Request) -> Response:
        """
        responses:
          200: {description: items.large from the store after the first request, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.large)

    # The Vary header tells a cache in front of the framework what the answer depends on. The store
    # keys on the route's own list, not on this header.
    # rb:handler cache.vary_one
    @replayed(on=one)
    async def vary_one(request: Request) -> Response:
        """
        parameters:
          - {name: x-rb-tenant, in: header, schema: {type: string}}
        responses:
          200: {description: items.small stored per tenant, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        response = fresh(p.small)
        response.headers["vary"] = ", ".join(one)
        return response

    # rb:handler cache.vary_many
    @replayed(on=many)
    async def vary_many(request: Request) -> Response:
        """
        parameters:
          - {name: x-rb-channel, in: header, schema: {type: string}}
          - {name: x-rb-region, in: header, schema: {type: string}}
          - {name: x-rb-tenant, in: header, schema: {type: string}}
        responses:
          200: {description: items.small stored per channel and region and tenant, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        response = fresh(p.small)
        response.headers["vary"] = ", ".join(many)
        return response

    return [
        Route("/cache/small", small),
        Route("/cache/medium", medium),
        Route("/cache/large", large),
        Route("/cache/vary/one", vary_one),
        Route("/cache/vary/many", vary_many),
    ]
