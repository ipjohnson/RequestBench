"""What the OpenAPI document says of a route beyond its path, method and captures, which is all
sanic-ext reads from a route. The helpers are sanic-ext's openapi decorators, which record what they
are given for the document and return the handler unchanged. A request body is stated in YAML in
the handler's docstring instead, which sanic-ext reads too, because its @openapi.body wraps the
handler in a coroutine that calls it."""
from inspect import isclass
from typing import Any

from pydantic import BaseModel
from sanic_ext import openapi

from models import Camel


class Item(Camel):
    """One row of items.large."""

    id: int
    name: str
    category: str
    price_cents: int
    in_stock: bool


class Payload(Camel):
    """items.small, items.medium or items.large."""

    size: str
    count: int
    items: list[Item]


class Refusal(BaseModel):
    """Sanic's error JSON, as a route whose handler answers with json() writes it."""

    description: str
    status: int
    message: str


def answers(content: Any, description: str, status: int = 200, media: str = "application/json"):
    """@openapi.response. A Pydantic model goes in as a component, so the document carries Pydantic's
    own schema of it rather than sanic-ext's reading of the class."""
    schema = openapi.definitions.Component(content) if isclass(content) and issubclass(content, BaseModel) else content
    return openapi.response(status, {media: schema}, description)


def refuses(status: int, description: str):
    return answers(Refusal, description, status)


def query_of(model: type[BaseModel]):
    """@openapi.parameter for each field of a model @validate binds the query string to, by the name
    the query carries it under."""

    def document(handler):
        for name, field in model.model_fields.items():
            openapi.parameter(field.alias or name, field.annotation, "query", required=True)(handler)
        return handler

    return document


def in_header(name: str, schema: type = str):
    return openapi.parameter(name, schema, "header", required=True)
