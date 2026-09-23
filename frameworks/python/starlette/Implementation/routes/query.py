from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from validation import Camel, spec


class Page(Camel):
    page: int


class Search(Camel):
    """query.many's eight values, which forms.urlencoded posts as a form."""

    page: int
    size: int
    status: str
    category: str
    sort: str
    q: str
    min_price: int
    max_price: int


def routes(p: Payloads) -> list[BaseRoute]:
    """query: the query string bound to a model by SpecTree, which Pydantic converts, so the model is
    already the echo."""

    # rb:handler query.one
    @spec.validate(query=Page)
    async def one(request: Request) -> JSONResponse:
        """
        parameters:
          - {name: page, in: query, required: true, schema: {type: integer}}
        responses:
          200: {description: items.small and the page, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedPage"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return JSONResponse({**p.small, "echo": request.context.query.model_dump()})

    # rb:handler query.many
    @spec.validate(query=Search)
    async def many(request: Request) -> JSONResponse:
        """
        parameters:
          - {name: page, in: query, required: true, schema: {type: integer}}
          - {name: size, in: query, required: true, schema: {type: integer}}
          - {name: status, in: query, required: true, schema: {type: string}}
          - {name: category, in: query, required: true, schema: {type: string}}
          - {name: sort, in: query, required: true, schema: {type: string}}
          - {name: q, in: query, required: true, schema: {type: string}}
          - {name: minPrice, in: query, required: true, schema: {type: integer}}
          - {name: maxPrice, in: query, required: true, schema: {type: integer}}
        responses:
          200: {description: items.small and the eight values, content: {application/json: {schema: {$ref: "#/components/schemas/EchoedSearch"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return JSONResponse({**p.small, "echo": request.context.query.model_dump()})

    return [
        Route("/query/one", one),
        Route("/query/many", many),
    ]
