from typing import Annotated

from fastapi import APIRouter, Query

from answers import Echoed
from payloads import Camel, Payloads


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


def router(p: Payloads) -> APIRouter:
    """query: the query string bound to a model, which FastAPI validates and converts, so the model
    is already the echo."""
    routes = APIRouter()

    @routes.get("/query/one")
    async def one(page: Annotated[Page, Query()]) -> Echoed[Page]:
        return Echoed[Page].of(p.small, page)

    @routes.get("/query/many")
    async def many(search: Annotated[Search, Query()]) -> Echoed[Search]:
        return Echoed[Search].of(p.small, search)

    return routes
