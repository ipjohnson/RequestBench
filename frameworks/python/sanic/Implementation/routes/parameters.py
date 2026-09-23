from sanic import Blueprint
from sanic.response import json

from answers import echoed
from documented import Payload, answers
from models import Camel
from payloads import Payloads


class One(Camel):
    one: int


class Two(Camel):
    one: int
    two: int


class EchoedOne(Payload):
    echo: One


class EchoedTwo(Payload):
    echo: Two


def blueprint(p: Payloads) -> Blueprint:
    """parameters: path captures, which Sanic's router converts to the int each one declares. The
    router tries a static route before a capture, so the order they are added in does not matter."""
    routes = Blueprint("parameters")

    @routes.get("/parameters/static/segment/literal")
    @answers(Payload, "items.small")
    async def static(request):
        return json(p.small)

    @routes.get("/parameters/<one:int>/segment/literal")
    @answers(EchoedOne, "items.small, with the capture")
    async def one(request, one: int):
        return json(echoed(p.small, {"one": one}))

    @routes.get("/parameters/<one:int>/with-second/<two:int>")
    @answers(EchoedTwo, "items.small, with both captures")
    async def two(request, one: int, two: int):
        return json(echoed(p.small, {"one": one, "two": two}))

    return routes
