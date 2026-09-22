from fastapi import APIRouter

from answers import Echoed
from payloads import Camel, Payload, Payloads


class One(Camel):
    one: int


class Two(Camel):
    one: int
    two: int


def router(p: Payloads) -> APIRouter:
    """parameters: path captures, each bound as the int its parameter declares."""
    routes = APIRouter()

    # First, because Starlette tries routes in the order they were added, and the capture below
    # matches this path too.
    @routes.get("/parameters/static/segment/literal")
    async def static() -> Payload:
        return p.small

    @routes.get("/parameters/{one}/segment/literal")
    async def one(one: int) -> Echoed[One]:
        return Echoed[One].of(p.small, One(one=one))

    @routes.get("/parameters/{one}/with-second/{two}")
    async def two(one: int, two: int) -> Echoed[Two]:
        return Echoed[Two].of(p.small, Two(one=one, two=two))

    return routes
