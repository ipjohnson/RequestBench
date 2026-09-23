from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads


def routes(p: Payloads) -> list[BaseRoute]:
    """json: a payload the framework already holds, serialised by JSONResponse with the standard
    library's json. Three static routes rather than one with a capture, so the router pays no
    capture here."""

    # rb:handler json.small,cors.scoped
    async def small(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.small)

    # rb:handler json.medium
    async def medium(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.medium, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.medium)

    # rb:handler json.large
    async def large(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.large, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.large)

    return [
        Route("/json/small", small),
        Route("/json/medium", medium),
        Route("/json/large", large),
    ]
