from sanic import Blueprint
from sanic.response import json

from documented import Payload, answers
from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """json: a payload the framework already holds, serialised by Sanic's json(), which writes with
    ujson, a dependency of Sanic's own. Three static routes rather than one with a capture, so the
    router pays no capture here."""
    routes = Blueprint("json")

    @routes.get("/json/small")
    @answers(Payload, "items.small")
    async def small(request):
        return json(p.small)

    @routes.get("/json/medium")
    @answers(Payload, "items.medium")
    async def medium(request):
        return json(p.medium)

    @routes.get("/json/large")
    @answers(Payload, "items.large")
    async def large(request):
        return json(p.large)

    return routes
