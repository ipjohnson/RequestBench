from litestar import Response, Router, get
# rb:wiring cors.*
from litestar.config.cors import CORSConfig

from payloads import Payload, Payloads
from serial import fresh


# rb:wiring cors.*
def config() -> CORSConfig:
    """The one policy, as the application's cors_config. Litestar takes CORS on the
    application alone, so the policy covers every route, and its middleware answers a preflight to
    any path before the router matches one."""
    return CORSConfig(allow_origins=["https://shop.example.com"], allow_methods=["GET"], allow_headers=["x-rb-tenant"],
                      max_age=600)
# rb:end


def router(p: Payloads) -> Router:
    """cors: the route the policy is for. The handler writes x-rb-serial, so its absence on a
    preflight shows the middleware answered alone."""

    @get("/cors/small")
    async def small() -> Response[Payload]:
        return Response(p.small, headers=fresh())

    return Router(path="/", route_handlers=[small])
