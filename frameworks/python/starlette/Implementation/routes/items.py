from starlette.endpoints import HTTPEndpoint
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import BaseRoute, Route

from payloads import Json, Payloads
from validation import Camel, spec


class NewItem(Camel):
    """An item as a client creates or replaces one."""

    name: str
    category: str
    price_cents: int
    in_stock: bool


class ItemPatch(Camel):
    """The two fields items.update changes."""

    price_cents: int | None = None
    in_stock: bool | None = None


def routes(p: Payloads) -> list[BaseRoute]:
    """items: every method on one resource over the rows of items.large. A measured row may not
    leave the server changed, so the writes store nothing and answer as if they had written. A
    missing row is an HTTPException, which Starlette answers with 404."""
    created = p.large["count"] + 1

    def found(request: Request) -> Json:
        row = p.row(request.path_params["id"])
        if row is None:
            raise HTTPException(status_code=404)
        return row

    class Item(HTTPEndpoint):
        """One class for the methods of /items/{id}, which Starlette's HTTPEndpoint dispatches by
        name. It answers HEAD with get, and a method it has no function for with 405."""

        # rb:handler items.read,items.head,errors.not_found
        async def get(self, request: Request) -> JSONResponse:
            """
            parameters:
              - {name: id, in: path, required: true, schema: {type: integer}}
            responses:
              200: {description: The row, content: {application/json: {schema: {$ref: "#/components/schemas/Item"}}}}
              404: {$ref: "#/components/responses/NotFound"}
            """
            return JSONResponse(found(request))

        # rb:handler items.replace
        @spec.validate(json=NewItem)
        async def put(self, request: Request) -> JSONResponse:
            """
            parameters:
              - {name: id, in: path, required: true, schema: {type: integer}}
            requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/NewItem"}}}}
            responses:
              200: {description: The item with the id in the path, content: {application/json: {schema: {$ref: "#/components/schemas/Item"}}}}
              422: {$ref: "#/components/responses/Refused"}
            """
            return JSONResponse({"id": request.path_params["id"], **request.context.json.model_dump()})

        # rb:handler items.update
        @spec.validate(json=ItemPatch)
        async def patch(self, request: Request) -> JSONResponse:
            """
            parameters:
              - {name: id, in: path, required: true, schema: {type: integer}}
            requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/ItemPatch"}}}}
            responses:
              200: {description: The row with the patch merged onto it, content: {application/json: {schema: {$ref: "#/components/schemas/Item"}}}}
              404: {$ref: "#/components/responses/NotFound"}
              422: {$ref: "#/components/responses/Refused"}
            """
            row = found(request)
            return JSONResponse({**row, **request.context.json.model_dump(exclude_unset=True)})

        # rb:handler items.delete
        async def delete(self, request: Request) -> Response:
            """
            parameters:
              - {name: id, in: path, required: true, schema: {type: integer}}
            responses:
              204: {description: Deleted}
              404: {$ref: "#/components/responses/NotFound"}
            """
            found(request)
            return Response(status_code=204)

    # rb:handler items.create
    @spec.validate(json=NewItem)
    async def create(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/NewItem"}}}}
        responses:
          201:
            description: The item with the id after the last row
            headers: {location: {required: true, schema: {type: string}}}
            content: {application/json: {schema: {$ref: "#/components/schemas/Item"}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return JSONResponse({"id": created, **request.context.json.model_dump()}, status_code=201,
                            headers={"location": f"/items/{created}"})

    return [
        Route("/items", create, methods=["POST"]),
        Route("/items/{id:int}", Item),
    ]
