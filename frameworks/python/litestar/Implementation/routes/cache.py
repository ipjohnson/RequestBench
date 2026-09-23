from litestar import Request, Response, Router, get

from payloads import Payload, Payloads
from serial import fresh


def router(p: Payloads) -> Router:
    """cache: the handler skipped and a stored answer written back, by Litestar's response cache. The
    handler writes x-rb-serial, so a replayed answer repeats the serial it was stored with."""
    settings = p.settings.cache
    one = tuple(settings.vary.one)
    many = tuple(settings.vary.many)

    # rb:wiring cache.*
    def keyed_on(names: tuple[str, ...]):
        """A route's key: its path, and the request headers the route varies on. Litestar's default
        key is the method, the path and the query."""

        def key(request: Request) -> str:
            return "|".join((request.url.path, *(request.headers.get(name, "") for name in names)))

        return key
    # rb:end

    # rb:wiring cache.*
    # cache=True turns the application's response cache on for the route, for the expiry the
    # application's ResponseCacheConfig sets. The cache answers from its store before the handler
    # runs, and stores what the handler answered.
    @get("/cache/small", cache=True)
    async def small() -> Response[Payload]:
        return Response(p.small, headers=fresh())
    # rb:end

    @get("/cache/medium", cache=True)
    async def medium() -> Response[Payload]:
        return Response(p.medium, headers=fresh())

    @get("/cache/large", cache=True)
    async def large() -> Response[Payload]:
        return Response(p.large, headers=fresh())

    # The Vary header tells a cache in front of the framework what the answer depends on. The store
    # keys on the route's own list, not on this header.
    @get("/cache/vary/one", cache=True, cache_key_builder=keyed_on(one))
    async def vary_one() -> Response[Payload]:
        return Response(p.small, headers={**fresh(), "vary": ", ".join(one)})

    @get("/cache/vary/many", cache=True, cache_key_builder=keyed_on(many))
    async def vary_many() -> Response[Payload]:
        return Response(p.small, headers={**fresh(), "vary": ", ".join(many)})

    return Router(path="/", route_handlers=[small, medium, large, vary_one, vary_many])
