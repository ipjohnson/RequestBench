from sanic import Blueprint
from sanic.response import json
# rb:wiring cors.*
from sanic_ext import cors

from documented import Payload, answers
from payloads import Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """cors: sanic-ext's CORS, with the policy on the one route. sanic-ext answers a preflight with
    its automatic OPTIONS handler, and writes the CORS headers from a response hook on the whole
    application, which leaves an answer alone unless its route's policy allows the request's
    origin. The application's own policy names no origin, so no other route answers with CORS
    headers. The handler writes x-rb-serial, so its absence on a preflight shows no handler ran."""
    settings = p.settings["cors"]
    routes = Blueprint("cors")

    # rb:wiring cors.*
    policy = cors(origin=settings["origin"], allow_methods=[settings["method"]], allow_headers=[settings["header"]],
                  max_age=settings["maxAgeSeconds"])

    @routes.get("/cors/small")
    @answers(Payload, "items.small")
    @policy
    async def small(request):
        return json(p.small, headers=fresh())

    return routes
