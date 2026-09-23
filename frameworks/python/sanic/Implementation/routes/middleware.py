from sanic import Blueprint
from sanic.response import json

from documented import Payload, answers
from payloads import Payloads


# rb:wiring middleware.*
async def noop(request) -> None:
    """One layer: Sanic runs it before the handler, and it returns nothing, so Sanic carries on."""


def layered(name: str, count: int) -> Blueprint:
    """Sanic has no middleware on a route. A blueprint's middleware runs on that blueprint's routes
    alone, so each count of layers is a blueprint of its own."""
    routes = Blueprint(name)
    for _ in range(count):
        routes.on_request(noop)
    return routes
# rb:end


def blueprints(p: Payloads) -> tuple[Blueprint, ...]:
    """middleware: no-op layers in front of the handler."""
    none = layered("middleware_none", 0)
    four = layered("middleware_four", 4)
    sixteen = layered("middleware_sixteen", 16)

    @none.get("/middleware/none")
    @answers(Payload, "items.small")
    async def unlayered(request):
        return json(p.small)

    @four.get("/middleware/four")
    @answers(Payload, "items.small")
    async def four_layers(request):
        return json(p.small)

    @sixteen.get("/middleware/sixteen")
    @answers(Payload, "items.small")
    async def sixteen_layers(request):
        return json(p.small)

    return none, four, sixteen
