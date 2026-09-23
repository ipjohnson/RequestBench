from sanic import Blueprint
from sanic.response import json
from sanic_ext import openapi, validate

from answers import echoed
from documented import Payload, answers, query_of, refuses
from models import Camel
from payloads import Payloads


class Page(Camel):
    page: int


@openapi.component
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


class EchoedPage(Payload):
    echo: Page


class EchoedSearch(Payload):
    echo: Search


def blueprint(p: Payloads) -> Blueprint:
    """query: the query string bound to a model by sanic-ext's @validate, which converts each value
    to the type the model declares, so the model is already the echo."""
    routes = Blueprint("query")

    @routes.get("/query/one")
    @query_of(Page)
    @answers(EchoedPage, "items.small, with the page")
    @refuses(400, "sanic-ext's refusal of a value the model cannot bind")
    @validate(query=Page)
    async def one(request, query: Page):
        return json(echoed(p.small, query.model_dump()))

    @routes.get("/query/many")
    @query_of(Search)
    @answers(EchoedSearch, "items.small, with the eight values")
    @refuses(400, "sanic-ext's refusal of a value the model cannot bind")
    @validate(query=Search)
    async def many(request, query: Search):
        return json(echoed(p.small, query.model_dump()))

    return routes
