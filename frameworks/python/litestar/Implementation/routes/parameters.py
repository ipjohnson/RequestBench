from litestar import Router, get
from litestar.params import FromPath

from answers import Echoed
from payloads import Camel, Payload, Payloads


class One(Camel):
    one: int


class Two(Camel):
    one: int
    two: int


def router(p: Payloads) -> Router:
    """parameters: path captures, each typed int in the path and declared FromPath, which Litestar converts."""

    @get("/parameters/static/segment/literal")
    async def static() -> Payload:
        return p.small

    @get("/parameters/{one:int}/segment/literal")
    async def one(one: FromPath[int]) -> Echoed[One]:
        return Echoed[One].of(p.small, One(one=one))

    @get("/parameters/{one:int}/with-second/{two:int}")
    async def two(one: FromPath[int], two: FromPath[int]) -> Echoed[Two]:
        return Echoed[Two].of(p.small, Two(one=one, two=two))

    return Router(path="/", route_handlers=[static, one, two])
