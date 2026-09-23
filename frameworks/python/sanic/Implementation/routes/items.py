from sanic import Blueprint
from sanic.exceptions import NotFound
from sanic.response import empty, json
from sanic_ext import openapi, validate

from documented import Item, answers, refuses
from models import Camel
from payloads import Payloads


@openapi.component
class NewItem(Camel):
    """An item as a client creates or replaces one."""

    name: str
    category: str
    price_cents: int
    in_stock: bool


@openapi.component
class ItemPatch(Camel):
    """The two fields items.update changes."""

    price_cents: int | None = None
    in_stock: bool | None = None


def blueprint(p: Payloads) -> Blueprint:
    """items: every method on one resource over the rows of items.large. A measured row may not
    leave the server changed, so the writes store nothing and answer as if they had written. A
    missing row is Sanic's NotFound, and Sanic's router answers a method the path has no route for
    with 405."""
    routes = Blueprint("items")
    created = p.large["count"] + 1

    # sanic-ext adds a HEAD route beside every GET route, which runs the GET handler, and Sanic
    # leaves the body unwritten for HEAD.
    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    @routes.get("/items/<id:int>")
    @answers(Item, "The row")
    @refuses(404, "Sanic's NotFound, for an id with no row")
    async def read(request, id: int):
        row = p.row(id)
        if row is None:
            raise NotFound()
        return json(row)

    # rb:handler items.create
    @routes.post("/items")
    @answers(Item, "The row as it would be created", 201)
    @refuses(400, "sanic-ext's refusal of a body the model cannot bind")
    @validate(json=NewItem)
    async def create(request, body: NewItem):
        """Answers as if the row after the last had been created.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/NewItem"}}}}
        """
        return json({"id": created, **body.model_dump()}, status=201, headers={"location": f"/items/{created}"})

    # rb:handler items.replace
    @routes.put("/items/<id:int>")
    @answers(Item, "The row as it would be replaced")
    @refuses(400, "sanic-ext's refusal of a body the model cannot bind")
    @validate(json=NewItem)
    async def replace(request, id: int, body: NewItem):
        """Answers as if the row had been replaced.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/NewItem"}}}}
        """
        return json({"id": id, **body.model_dump()})

    # rb:handler items.update
    @routes.patch("/items/<id:int>")
    @answers(Item, "The row as it would be updated")
    @refuses(400, "sanic-ext's refusal of a body the model cannot bind")
    @refuses(404, "Sanic's NotFound, for an id with no row")
    @validate(json=ItemPatch)
    async def update(request, id: int, body: ItemPatch):
        """Answers as if the patch had been merged onto the row.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/ItemPatch"}}}}
        """
        row = p.row(id)
        if row is None:
            raise NotFound()
        return json(row | body.model_dump(exclude_unset=True))

    # rb:handler items.delete
    @routes.delete("/items/<id:int>")
    async def delete(request, id: int):
        """Answers as if the row had been deleted.

        openapi:
        ---
        responses:
          "204": {description: No content}
          "404": {description: "Sanic's NotFound, for an id with no row", content: {application/json: {schema: {$ref: "#/components/schemas/Refusal"}}}}
        """
        if p.row(id) is None:
            raise NotFound()
        return empty()

    return routes
