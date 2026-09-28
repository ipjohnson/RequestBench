from collections.abc import Awaitable, Callable

# rb:wiring cache.*
from cachetools import TTLCache
from fastapi import APIRouter, Request, Response
from fastapi.routing import APIRoute

from payloads import Payload, Payloads
from serial import fresh


def router(p: Payloads) -> APIRouter:
    """cache: the handler skipped and a stored answer written back. The handler writes
    x-rb-serial, so a replayed answer repeats the serial it was stored with."""
    one = ("x-rb-tenant",)
    many = ("x-rb-channel", "x-rb-region", "x-rb-tenant")
    # By route name, which FastAPI takes from the handler.
    varies = {"vary_one": one, "vary_many": many}

    # rb:wiring cache.*
    # Each worker holds a store of its own, with room for the cache family's 52 keys, each kept 30
    # seconds.
    store: TTLCache = TTLCache(maxsize=64, ttl=30)

    class Replayed(APIRoute):
        """FastAPI ships no response cache, and a route class is its hook around the whole handling
        of one route. This one answers from the store before FastAPI reads the request, and stores
        the response the handler's answer was written to. The key is the path and query, and the
        request headers the route varies on."""

        def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
            handle = super().get_route_handler()
            on = varies.get(self.name, ())

            async def replay(request: Request) -> Response:
                key = (request.url.path, request.url.query, *(request.headers.get(name, "") for name in on))
                stored = store.get(key)
                if stored is not None:
                    return stored
                response = await handle(request)
                if response.status_code == 200:
                    store[key] = response
                return response

            return replay
    # rb:end

    routes = APIRouter(route_class=Replayed)

    @routes.get("/cache/small/{key}")
    async def small(response: Response, key: str) -> Payload:
        return fresh(response, p.small)

    @routes.get("/cache/medium/{key}")
    async def medium(response: Response, key: str) -> Payload:
        return fresh(response, p.medium)

    @routes.get("/cache/large/{key}")
    async def large(response: Response, key: str) -> Payload:
        return fresh(response, p.large)

    # The Vary header tells a cache in front of the framework what the answer depends on. The store
    # keys on the route's own list, not on this header.
    @routes.get("/cache/vary/one/{key}")
    async def vary_one(response: Response, key: str) -> Payload:
        response.headers["vary"] = ", ".join(one)
        return fresh(response, p.small)

    @routes.get("/cache/vary/many/{key}")
    async def vary_many(response: Response, key: str) -> Payload:
        response.headers["vary"] = ", ".join(many)
        return fresh(response, p.small)

    return routes
