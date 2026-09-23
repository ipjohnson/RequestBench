import gzip

from sanic import Blueprint
from sanic.response import json

from documented import Payload, answers
from payloads import Payloads
from serial import fresh

# rb:wiring compressed.*
# A body under 500 bytes goes out as it is, the floor Starlette's GZipMiddleware keeps by default.
MINIMUM = 500


def blueprint(p: Payloads) -> Blueprint:
    """compressed: the blueprint's response middleware gzips an answer when the request asks. Its
    routes answer like any other."""
    routes = Blueprint("compressed")

    # rb:wiring compressed.*
    @routes.on_response
    async def gzipped(request, response):
        """Sanic and Sanic Extensions compress nothing, so this family gzips by hand, at level 1,
        the fastest level every framework here compresses at."""
        if "gzip" not in request.headers.get("accept-encoding", "") or len(response.body) < MINIMUM:
            return
        response.body = gzip.compress(response.body, compresslevel=1)
        response.headers["content-encoding"] = "gzip"
        response.headers["vary"] = "accept-encoding"
    # rb:end

    # rb:handler compressed.gzip_small,compressed.identity_small
    @routes.get("/compressed/small")
    @answers(Payload, "items.small")
    async def small(request):
        return json(p.small, headers=fresh())

    # rb:handler compressed.gzip_large,compressed.identity_large
    @routes.get("/compressed/large")
    @answers(Payload, "items.large")
    async def large(request):
        return json(p.large, headers=fresh())

    return routes
