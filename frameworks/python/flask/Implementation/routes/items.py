from flask import Blueprint, abort
from flask_pydantic import validate

from models import Camel
from payloads import Json, Payloads


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


def blueprint(p: Payloads) -> Blueprint:
    """items: every method on one resource over the rows of items.large. A measured row may not
    leave the server changed, so the writes store nothing and answer as if they had written. A
    missing row is Werkzeug's NotFound through abort, and Werkzeug's router answers a method the
    path has no route for with 405. Flask-Pydantic binds the bodies."""
    routes = Blueprint("items", __name__)
    created = p.large["count"] + 1

    # Flask answers HEAD on every GET route, and Werkzeug leaves the body unwritten for it.
    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    @routes.get("/items/<int:id>")
    def read(id: int) -> Json:
        row = p.row(id)
        if row is None:
            abort(404)
        return row

    # The blueprint's name and every payload's items key read as this route too.
    # rb:handler items.create
    @routes.post("/items")
    @validate()
    def create(body: NewItem) -> tuple[Json, int, dict[str, str]]:
        return {"id": created, **body.model_dump()}, 201, {"location": f"/items/{created}"}

    # rb:handler items.replace
    @routes.put("/items/<int:id>")
    @validate()
    def replace(id: int, body: NewItem) -> Json:
        return {"id": id, **body.model_dump()}

    # rb:handler items.update
    @routes.patch("/items/<int:id>")
    @validate()
    def update(id: int, body: ItemPatch) -> Json:
        row = p.row(id)
        if row is None:
            abort(404)
        return row | body.model_dump(exclude_unset=True)

    # rb:handler items.delete
    @routes.delete("/items/<int:id>")
    def delete(id: int) -> tuple[str, int]:
        if p.row(id) is None:
            abort(404)
        return "", 204

    return routes
