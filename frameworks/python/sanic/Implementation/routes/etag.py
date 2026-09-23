from hashlib import sha1

from sanic import Blueprint
from sanic.response import HTTPResponse, json

from documented import Payload, answers
from payloads import Payloads
from serial import fresh


def blueprint(p: Payloads) -> Blueprint:
    """etag: the blueprint's response middleware computes the validator, which no other route has."""
    routes = Blueprint("etag")

    # rb:wiring etag.*
    @routes.on_response
    async def tagged(request, response):
        """Sanic computes no validator for a body a handler writes, only Last-Modified for a file, so
        this family is wired by hand. It hashes the body with SHA-1, and answers 304 when
        If-None-Match already names the hash. The body is built and hashed before anything is
        compared, so a 304 saves the write and nothing else."""
        tag = f'"{sha1(response.body).hexdigest()}"'
        if tag in named(request.headers.get("if-none-match", "")):
            kept = {name: value for name, value in response.headers.items() if name not in ("content-length", "content-type")}
            return HTTPResponse(status=304, headers={**kept, "etag": tag})
        response.headers["etag"] = tag
    # rb:end

    @routes.get("/etag/small")
    @answers(Payload, "items.small")
    async def small(request):
        return json(p.small, headers=fresh())

    @routes.get("/etag/large")
    @answers(Payload, "items.large")
    async def large(request):
        return json(p.large, headers=fresh())

    return routes


# rb:wiring etag.*
def named(if_none_match: str) -> set[str]:
    """The tags an If-None-Match lists, compared weakly, so W/ is dropped from each."""
    return {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
# rb:end
