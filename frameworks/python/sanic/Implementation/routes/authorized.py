from functools import wraps

from sanic import Blueprint
from sanic.exceptions import Forbidden
from sanic.response import json

from documented import Payload, answers, refuses
from payloads import Payloads


def blueprint(p: Payloads) -> Blueprint:
    """authorized: Sanic has no authorization of its own, so the route carries the decorator Sanic's
    authentication guide writes, which checks the request before the handler runs."""
    token = p.settings["token"]

    # rb:wiring authorized.*
    def protected(handler):
        """Reads the bearer token Sanic parses from Authorization into request.token. Any token but
        settings.json's, or none, is Sanic's own Forbidden, 403."""

        @wraps(handler)
        async def checked(request, *args, **kwargs):
            if request.token != token:
                raise Forbidden()
            return await handler(request, *args, **kwargs)

        return checked
    # rb:end

    routes = Blueprint("authorized")

    @routes.get("/authorized/small")
    @answers(Payload, "items.small")
    @refuses(403, "Sanic's Forbidden, for any token but the accepted one")
    @protected
    async def small(request):
        return json(p.small)

    return routes
