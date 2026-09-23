from litestar import Router, get
from litestar.connection import ASGIConnection
# rb:wiring authorized.*
from litestar.exceptions import PermissionDeniedException
from litestar.handlers.base import BaseRouteHandler

from payloads import Payload, Payloads


def router(p: Payloads) -> Router:
    """authorized: a guard on the route compares the bearer token before the handler runs."""
    expected = f"Bearer {p.settings.token}"

    # rb:wiring authorized.*
    def require_token(connection: ASGIConnection, _: BaseRouteHandler) -> None:
        """A guard, Litestar's own authorization facility. Any authorization header but settings.json's
        token, or none, is PermissionDeniedException, which Litestar answers with 403."""
        if connection.headers.get("authorization") != expected:
            raise PermissionDeniedException()
    # rb:end

    @get("/authorized/small", guards=[require_token])
    async def small() -> Payload:
        return p.small

    return Router(path="/", route_handlers=[small])
