from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route
from starlette.types import ASGIApp, Receive, Scope, Send

from payloads import Payloads


# rb:wiring middleware.*
class Noop:
    """One layer: a pure ASGI middleware that calls the next and does nothing else."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self.app(scope, receive, send)


def layers(count: int) -> list[Middleware]:
    """A Route takes its own middleware, which wraps the endpoint alone, so no other route runs
    these."""
    return [Middleware(Noop) for _ in range(count)]
# rb:end


def routes(p: Payloads) -> list[BaseRoute]:
    """middleware: no-op layers in front of the endpoint."""

    # rb:handler middleware.none,middleware.four,middleware.sixteen
    async def small(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.small)

    return [
        Route("/middleware/none", small),
        Route("/middleware/four", small, middleware=layers(4)),
        Route("/middleware/sixteen", small, middleware=layers(16)),
    ]
