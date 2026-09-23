from collections.abc import Awaitable, Callable
from functools import wraps
from hashlib import sha1

from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from serial import fresh

type Endpoint = Callable[[Request], Awaitable[Response]]


# rb:wiring etag.*
def tagged(endpoint: Endpoint) -> Endpoint:
    """Starlette computes no validator for a dynamic answer, so this family is wired by hand, as a
    decorator on the endpoint. It hashes the body the endpoint's response holds, and answers 304
    when If-None-Match already names the hash. The body is built and hashed before anything is
    compared, so a 304 saves the write and nothing else."""

    @wraps(endpoint)
    async def revalidate(request: Request) -> Response:
        response = await endpoint(request)
        tag = f'"{sha1(response.body).hexdigest()}"'
        if tag in named(request.headers.get("if-none-match", "")):
            kept = {name: value for name, value in response.headers.items() if name not in ("content-length", "content-type")}
            return Response(status_code=304, headers={**kept, "etag": tag})
        response.headers["etag"] = tag
        return response

    return revalidate


def named(if_none_match: str) -> set[str]:
    """The tags an If-None-Match lists, compared weakly, so W/ is dropped from each."""
    return {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
# rb:end


def routes(p: Payloads) -> list[BaseRoute]:
    """etag: a decorator on this family's endpoints, which no other endpoint has."""

    # rb:handler etag.small
    @tagged
    async def small(request: Request) -> Response:
        """
        parameters:
          - {name: if-none-match, in: header, schema: {type: string}}
        responses:
          200: {description: items.small with its ETag, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
          304: {description: If-None-Match names the ETag}
        """
        return fresh(p.small)

    # rb:handler etag.large,etag.match_large,etag.stale_large
    @tagged
    async def large(request: Request) -> Response:
        """
        parameters:
          - {name: if-none-match, in: header, schema: {type: string}}
        responses:
          200: {description: items.large with its ETag, content: {application/json: {schema: {$ref: "#/components/schemas/Payload"}}}}
          304: {description: If-None-Match names the ETag}
        """
        return fresh(p.large)

    return [
        Route("/etag/small", small),
        Route("/etag/large", large),
    ]
