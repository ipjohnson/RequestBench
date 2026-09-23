from litestar import Router, get
from litestar.enums import ScopeType
# rb:wiring middleware.*
from litestar.middleware import ASGIMiddleware
from litestar.types import ASGIApp, Receive, Scope, Send

from payloads import Payload, Payloads


# rb:wiring middleware.*
class Noop(ASGIMiddleware):
    """One layer: it calls the next and does nothing else. ASGIMiddleware is the base Litestar's
    documentation recommends for a middleware of one's own."""

    scopes = (ScopeType.HTTP,)

    async def handle(self, scope: Scope, receive: Receive, send: Send, next_app: ASGIApp) -> None:
        await next_app(scope, receive, send)


def layers(count: int) -> list[Noop]:
    return [Noop() for _ in range(count)]
# rb:end


def router(p: Payloads) -> Router:
    """middleware: no-op layers on the route, in front of the handler."""

    @get("/middleware/none")
    async def none() -> Payload:
        return p.small

    @get("/middleware/four", middleware=layers(4))
    async def four() -> Payload:
        return p.small

    @get("/middleware/sixteen", middleware=layers(16))
    async def sixteen() -> Payload:
        return p.small

    return Router(path="/", route_handlers=[none, four, sixteen])
