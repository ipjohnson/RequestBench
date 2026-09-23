from typing import Annotated

from litestar import Router, get
from litestar.params import FromQuery, QueryParameter

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


def router(p: Payloads) -> Router:
    """query: each value a handler parameter, which Litestar reads from the query string and converts.
    FromQuery reads the key of the parameter's own name, and QueryParameter names another."""

    @get("/query/one")
    async def one(page: FromQuery[int]) -> Echoed[Page]:
        return Echoed[Page].of(p.small, Page(page=page))

    @get("/query/many")
    async def many(page: FromQuery[int], size: FromQuery[int], status: FromQuery[str], category: FromQuery[str],
                   sort: FromQuery[str], q: FromQuery[str], min_price: Annotated[int, QueryParameter(name="minPrice")],
                   max_price: Annotated[int, QueryParameter(name="maxPrice")]) -> Echoed[Search]:
        return Echoed[Search].of(p.small, Search(page=page, size=size, status=status, category=category, sort=sort, q=q,
                                                  min_price=min_price, max_price=max_price))

    return Router(path="/", route_handlers=[one, many])
