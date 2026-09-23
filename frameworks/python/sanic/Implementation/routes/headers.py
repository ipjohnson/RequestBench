from sanic import Blueprint
from sanic.response import json

from answers import echoed
from documented import Payload, answers, in_header
from models import Camel
from payloads import Payloads


class HeadersBound(Camel):
    tenant: str
    request_id: str
    account: int


class EchoedHeaders(Payload):
    echo: HeadersBound


def blueprint(p: Payloads) -> Blueprint:
    """headers: /headers reads no header, and /headers/bind reads three. Sanic and sanic-ext bind no
    header, so the handler reads each by name and converts the account with int()."""
    routes = Blueprint("headers")

    # rb:handler headers.few,headers.many
    @routes.get("/headers")
    @answers(Payload, "items.small")
    async def unread(request):
        return json(p.small)

    @routes.get("/headers/bind")
    @in_header("x-rb-tenant")
    @in_header("x-rb-request-id")
    @in_header("x-rb-account", int)
    @answers(EchoedHeaders, "items.small, with the three headers")
    async def bind(request):
        headers = request.headers
        return json(echoed(p.small, {"tenant": headers["x-rb-tenant"], "requestId": headers["x-rb-request-id"],
                                     "account": int(headers["x-rb-account"])}))

    return routes
