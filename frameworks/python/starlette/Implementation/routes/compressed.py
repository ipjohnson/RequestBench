from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from serial import fresh

# rb:wiring compressed.*
# Starlette's GZipMiddleware on each of the family's routes, which gzips an answer when the request
# asks. A body under 500 bytes goes out as it is, which is the middleware's default, and gzip runs
# at level 1, the fastest level every framework here compresses at. Its own default is 9.
GZIP = [Middleware(GZipMiddleware, compresslevel=1)]
# rb:end


def routes(p: Payloads) -> list[BaseRoute]:
    """compressed: the payloads behind the route's own gzip middleware."""

    # rb:handler compressed.gzip_small,compressed.identity_small
    async def small(request: Request) -> Response:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.small)

    # rb:handler compressed.gzip_large,compressed.identity_large
    async def large(request: Request) -> Response:
        """
        responses:
          200: {description: items.large gzipped when the request asks, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.large)

    return [
        Route("/compressed/small", small, middleware=GZIP),
        Route("/compressed/large", large, middleware=GZIP),
    ]
