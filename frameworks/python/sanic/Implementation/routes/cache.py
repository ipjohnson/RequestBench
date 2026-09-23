from dataclasses import dataclass

# rb:wiring cache.*
from cachetools import TTLCache
from sanic import Blueprint
from sanic.response import HTTPResponse, json

from documented import Payload, answers
from payloads import Payloads
from serial import fresh


# rb:wiring cache.*
@dataclass(frozen=True)
class Stored:
    """What a replay writes back. Sanic adds the framing headers to a response as it sends it, so the
    store keeps the parts and builds a new response from them each time."""

    body: bytes
    status: int
    headers: dict[str, str]
    content_type: str

    def response(self) -> HTTPResponse:
        return HTTPResponse(self.body, status=self.status, headers=self.headers, content_type=self.content_type)


def blueprint(p: Payloads) -> Blueprint:
    """cache: the handler skipped and a stored answer written back. The handler writes x-rb-serial,
    so a replayed answer repeats the serial it was stored with."""
    settings = p.settings["cache"]
    one = tuple(settings["vary"]["one"])
    many = tuple(settings["vary"]["many"])

    routes = Blueprint("cache")

    # rb:wiring cache.*
    # Each worker holds a store of its own, sized in entries by settings.json.
    store: TTLCache = TTLCache(maxsize=settings["capacity"], ttl=settings["ttlSeconds"])

    @routes.on_request
    async def replay(request):
        """Sanic ships no response cache. Request middleware that returns a response is answered in
        the handler's place, so this answers from the store. The key is the path and query, and the
        request headers the route's ctx names."""
        key = (request.path, request.query_string, *(request.headers.get(name, "") for name in request.route.ctx.vary))
        stored = store.get(key)
        if stored is not None:
            return stored.response()
        request.ctx.cache_key = key

    @routes.on_response
    async def keep(request, response):
        """Stores what the handler answered, under the key the request middleware made."""
        key = getattr(request.ctx, "cache_key", None)
        if key is not None and response.status == 200:
            store[key] = Stored(response.body, response.status, dict(response.headers), response.content_type)
    # rb:end

    @routes.get("/cache/small", ctx_vary=())
    @answers(Payload, "items.small")
    async def small(request):
        return json(p.small, headers=fresh())

    @routes.get("/cache/medium", ctx_vary=())
    @answers(Payload, "items.medium")
    async def medium(request):
        return json(p.medium, headers=fresh())

    @routes.get("/cache/large", ctx_vary=())
    @answers(Payload, "items.large")
    async def large(request):
        return json(p.large, headers=fresh())

    # The Vary header tells a cache in front of the framework what the answer depends on. The store
    # keys on the route's ctx, not on this header.
    @routes.get("/cache/vary/one", ctx_vary=one)
    @answers(Payload, "items.small")
    async def vary_one(request):
        return json(p.small, headers={**fresh(), "vary": ", ".join(one)})

    @routes.get("/cache/vary/many", ctx_vary=many)
    @answers(Payload, "items.small")
    async def vary_many(request):
        return json(p.small, headers={**fresh(), "vary": ", ".join(many)})

    return routes
