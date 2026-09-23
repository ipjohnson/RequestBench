from pydantic import Field
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from validation import Camel, spec


class HeadersBound(Camel):
    """The three headers /headers/bind binds, each read by its header name. Starlette's Headers are
    what SpecTree hands to the model, and Pydantic reads the three names out of them."""

    tenant: str = Field(validation_alias="x-rb-tenant")
    request_id: str = Field(validation_alias="x-rb-request-id")
    account: int = Field(validation_alias="x-rb-account")


def routes(p: Payloads) -> list[BaseRoute]:
    """headers: /headers reads no header, and /headers/bind binds three through SpecTree, the account
    as an int."""

    # rb:handler headers.few,headers.many
    async def unread(request: Request) -> JSONResponse:
        """
        responses:
          200: {description: items.small, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
        """
        return JSONResponse(p.small)

    # rb:handler headers.bind_few,headers.bind_many
    @spec.validate(headers=HeadersBound)
    async def bind(request: Request) -> JSONResponse:
        """
        parameters:
          - {name: x-rb-tenant, in: header, required: true, schema: {type: string}}
          - {name: x-rb-request-id, in: header, required: true, schema: {type: string}}
          - {name: x-rb-account, in: header, required: true, schema: {type: integer}}
        responses:
          200: {description: items.small and the three headers, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedHeaders"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return JSONResponse({**p.small, "echo": request.context.headers.model_dump()})

    return [
        Route("/headers", unread),
        Route("/headers/bind", bind),
    ]
