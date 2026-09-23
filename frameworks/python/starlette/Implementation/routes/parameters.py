from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads


def routes(p: Payloads) -> list[BaseRoute]:
    """parameters: path captures, each converted to an int by the route's own int convertor, which
    matches digits alone. A segment that is not one matches no route."""

    # rb:handler parameters.static
    async def static(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.small)

    # rb:handler parameters.one
    async def one(request: Request) -> JSONResponse:
        """
        parameters:
          - {name: one, in: path, required: true, schema: {type: integer}}
        responses:
          200: {description: items.small and the capture, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedOne"}}}}
        """
        return JSONResponse({**p.small, "echo": {"one": request.path_params["one"]}})

    # rb:handler parameters.two
    async def two(request: Request) -> JSONResponse:
        """
        parameters:
          - {name: one, in: path, required: true, schema: {type: integer}}
          - {name: two, in: path, required: true, schema: {type: integer}}
        responses:
          200: {description: items.small and both captures, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedTwo"}}}}
        """
        captured = request.path_params
        return JSONResponse({**p.small, "echo": {"one": captured["one"], "two": captured["two"]}})

    return [
        Route("/parameters/static/segment/literal", static),
        Route("/parameters/{one:int}/segment/literal", one),
        Route("/parameters/{one:int}/with-second/{two:int}", two),
    ]
