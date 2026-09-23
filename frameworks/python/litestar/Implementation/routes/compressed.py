from litestar import Response, Router, get
# rb:wiring compressed.*
from litestar.config.compression import CompressionConfig
from litestar.middleware import DefineMiddleware
from litestar.middleware.compression import CompressionMiddleware

from payloads import Payload, Payloads
from serial import fresh


def router(p: Payloads) -> Router:
    """compressed: Litestar's compression middleware on this family's Router alone, which gzips an
    answer when the request asks. The application's own compression_config would put it in front of
    every route."""
    # rb:wiring compressed.*
    # A body under 500 bytes goes out as it is, which is the default minimum_size, and gzip runs at
    # level 1, the fastest level every framework here compresses at. Litestar's own default is 9.
    gzip = DefineMiddleware(CompressionMiddleware, config=CompressionConfig(backend="gzip", gzip_compress_level=1))

    @get("/compressed/small")
    async def small() -> Response[Payload]:
        return Response(p.small, headers=fresh())

    @get("/compressed/large")
    async def large() -> Response[Payload]:
        return Response(p.large, headers=fresh())

    return Router(path="/", route_handlers=[small, large], middleware=[gzip])
