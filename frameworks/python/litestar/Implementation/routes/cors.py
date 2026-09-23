from litestar import Response, Router, get
# rb:wiring cors.*
from litestar.config.cors import CORSConfig

from payloads import Payload, Payloads
from serial import fresh


# rb:wiring cors.*
def config(p: Payloads) -> CORSConfig:
    """settings.json's policy, as the application's cors_config. Litestar takes CORS on the
    application alone, so the policy covers every route, and its middleware answers a preflight to
    any path before the router matches one."""
    settings = p.settings.cors
    return CORSConfig(allow_origins=[settings.origin], allow_methods=[settings.method], allow_headers=[settings.header],
                      max_age=settings.max_age_seconds)
# rb:end


def router(p: Payloads) -> Router:
    """cors: the route the policy is for. The handler writes x-rb-serial, so its absence on a
    preflight shows the middleware answered alone."""

    @get("/cors/small")
    async def small() -> Response[Payload]:
        return Response(p.small, headers=fresh())

    return Router(path="/", route_handlers=[small])
