from fastapi import APIRouter, HTTPException, Response

from payloads import Camel, Item, Payloads


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


def router(p: Payloads) -> APIRouter:
    """items: every method on one resource over the rows of items.large. A measured row may not
    leave the server changed, so the writes store nothing and answer as if they had written. A
    missing row is an HTTPException, which FastAPI answers with 404, and Starlette's router answers
    a method the path has no route for with 405."""
    routes = APIRouter()
    created = p.large.count + 1

    # A FastAPI route answers only the methods it names, so the read route names HEAD beside GET,
    # and uvicorn leaves the body unwritten for HEAD.
    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    @routes.api_route("/items/{id}", methods=["GET", "HEAD"])
    async def read(id: int) -> Item:
        row = p.row(id)
        if row is None:
            raise HTTPException(status_code=404)
        return row

    @routes.post("/items", status_code=201)
    async def create(item: NewItem, response: Response) -> Item:
        response.headers["location"] = f"/items/{created}"
        return Item(id=created, **item.model_dump(by_alias=False))

    # rb:handler items.replace
    @routes.put("/items/{id}")
    async def replace(id: int, item: NewItem) -> Item:
        return Item(id=id, **item.model_dump(by_alias=False))

    # rb:handler items.update
    @routes.patch("/items/{id}")
    async def update(id: int, patch: ItemPatch) -> Item:
        row = p.row(id)
        if row is None:
            raise HTTPException(status_code=404)
        return row.model_copy(update=patch.model_dump(by_alias=False, exclude_unset=True))

    # rb:handler items.delete
    @routes.delete("/items/{id}", status_code=204)
    async def delete(id: int) -> None:
        if p.row(id) is None:
            raise HTTPException(status_code=404)

    return routes
