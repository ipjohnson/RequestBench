from flask import Blueprint, request

from answers import echoed
from payloads import Json, Payloads


def blueprint(p: Payloads) -> Blueprint:
    """headers: /headers reads no header, and /headers/bind reads three from Werkzeug's Headers by
    name, whose get converts the account to an int."""
    routes = Blueprint("headers", __name__)

    # The blueprint's name reads as this route too.
    # rb:handler headers.few,headers.many
    @routes.get("/headers")
    def unread() -> Json:
        return p.small

    @routes.get("/headers/bind")
    def bind() -> Json:
        sent = request.headers
        return echoed(p.small, {"tenant": sent.get("x-rb-tenant"), "requestId": sent.get("x-rb-request-id"),
                                "account": sent.get("x-rb-account", type=int)})

    return routes
