from starlette.authentication import AuthCredentials, AuthenticationBackend, SimpleUser, requires
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.requests import HTTPConnection, Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads


# rb:wiring authorized.*
class BearerToken(AuthenticationBackend):
    """Starlette's authentication backend hook, run by AuthenticationMiddleware before the endpoint.
    A request whose bearer token is settings.json's is authenticated. Any other request is left
    unauthenticated, and `requires` refuses it with Starlette's own 403."""

    def __init__(self, token: str) -> None:
        self.token = token

    async def authenticate(self, conn: HTTPConnection) -> tuple[AuthCredentials, SimpleUser] | None:
        scheme, _, token = conn.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or token != self.token:
            return None
        return AuthCredentials(["authenticated"]), SimpleUser("bearer")
# rb:end


def routes(p: Payloads) -> list[BaseRoute]:
    """authorized: the route's own AuthenticationMiddleware reads the token, and `requires` checks
    what it found before the endpoint runs."""

    # rb:handler authorized.allowed,authorized.denied
    @requires("authenticated")
    async def small(request: Request) -> JSONResponse:
        """
        security:
          - bearer: []
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
          403: {description: Any other token or none, content: {text/plain: {schema: {type: string}}}}
        """
        return JSONResponse(p.small)

    # rb:wiring authorized.*
    authenticated = [Middleware(AuthenticationMiddleware, backend=BearerToken(p.settings["token"]))]

    return [Route("/authorized/small", small, middleware=authenticated)]
