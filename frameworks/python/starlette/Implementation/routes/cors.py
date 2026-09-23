from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import BaseRoute, Mount, Route

from payloads import Payloads
from serial import fresh


def routes(p: Payloads) -> list[BaseRoute]:
    """cors: Starlette's CORSMiddleware on a Mount at /cors. It answers a preflight before any route
    inside is matched, and adds its headers to the request itself. The endpoint writes x-rb-serial,
    so its absence on a preflight shows the middleware answered alone."""
    settings = p.settings["cors"]

    # rb:handler cors.request
    async def small(request: Request) -> Response:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return fresh(p.small)

    # A Route's own middleware runs only once the route has matched the method, and a preflight is
    # an OPTIONS request to a GET route, which the router answers with 405 first. A Mount's
    # middleware runs before the routes inside it are matched.
    # rb:wiring cors.*
    policy = Middleware(CORSMiddleware, allow_origins=[settings["origin"]], allow_methods=[settings["method"]],
                        allow_headers=[settings["header"]], max_age=settings["maxAgeSeconds"])

    return [Mount("/cors", routes=[Route("/small", small)], middleware=[policy])]
