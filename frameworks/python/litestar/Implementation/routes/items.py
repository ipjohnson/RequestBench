from litestar import HttpMethod, Response, Router, delete, patch, post, put, route
from litestar.exceptions import NotFoundException
from litestar.params import FromPath
from msgspec import UNSET, UnsetType, structs

from payloads import Camel, Item, Payloads


class NewItem(Camel):
    """An item as a client creates or replaces one."""

    name: str
    category: str
    price_cents: int
    in_stock: bool


class ItemPatch(Camel):
    """The two fields items.update changes. A field the body leaves out stays UNSET."""

    price_cents: int | UnsetType = UNSET
    in_stock: bool | UnsetType = UNSET


def router(p: Payloads) -> Router:
    """items: every method on one resource over the rows of items.large. A measured row may not
    leave the server changed, so the writes store nothing and answer as if they had written. A
    missing row is a NotFoundException, which Litestar answers with 404, and Litestar's router
    answers a method the path has no handler for with 405."""
    created = p.large.count + 1
    location = "/items/" + str(created)

    # A Litestar route answers only the methods it names, so the read route names HEAD beside GET,
    # and uvicorn leaves the body unwritten for HEAD.
    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    @route("/items/{id:int}", http_method=[HttpMethod.GET, HttpMethod.HEAD])
    async def read(id: FromPath[int]) -> Item:
        row = p.row(id)
        if row is None:
            raise NotFoundException()
        return row

    # POST answers 201 by default in Litestar.
    @post("/items")
    async def create(data: NewItem) -> Response[Item]:
        item = Item(id=created, name=data.name, category=data.category, price_cents=data.price_cents, in_stock=data.in_stock)
        return Response(item, headers={"location": location})

    # rb:handler items.replace
    @put("/items/{id:int}")
    async def replace(id: FromPath[int], data: NewItem) -> Item:
        return Item(id=id, name=data.name, category=data.category, price_cents=data.price_cents, in_stock=data.in_stock)

    # rb:handler items.update
    @patch("/items/{id:int}")
    async def update(id: FromPath[int], data: ItemPatch) -> Item:
        row = p.row(id)
        if row is None:
            raise NotFoundException()
        changed = {name: value for name in ItemPatch.__struct_fields__ if (value := getattr(data, name)) is not UNSET}
        return structs.replace(row, **changed)

    # DELETE answers 204 by default in Litestar.
    # rb:handler items.delete
    @delete("/items/{id:int}")
    async def remove(id: FromPath[int]) -> None:
        if p.row(id) is None:
            raise NotFoundException()

    return Router(path="/", route_handlers=[read, create, replace, update, remove])
