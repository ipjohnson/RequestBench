from collections.abc import Awaitable, Callable
from hashlib import sha1

from fastapi import APIRouter, Request, Response
from fastapi.routing import APIRoute

from payloads import Payload, Payloads
from serial import fresh


# rb:wiring etag.*
class Tagged(APIRoute):
    """FastAPI and Starlette compute no validator for a dynamic answer, so this family is wired by
    hand, as a route class around the whole handling of the route. It hashes the body the handler's
    answer was written to, and answers 304 when If-None-Match already names the hash. The body is
    built and hashed before anything is compared, so a 304 saves the write and nothing else."""

    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        handle = super().get_route_handler()

        async def tagged(request: Request) -> Response:
            response = await handle(request)
            tag = f'"{sha1(response.body).hexdigest()}"'
            if tag in named(request.headers.get("if-none-match", "")):
                kept = {name: value for name, value in response.headers.items() if name not in ("content-length", "content-type")}
                return Response(status_code=304, headers={**kept, "etag": tag})
            response.headers["etag"] = tag
            return response

        return tagged


def named(if_none_match: str) -> set[str]:
    """The tags an If-None-Match lists, compared weakly, so W/ is dropped from each."""
    return {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
# rb:end


def router(p: Payloads) -> APIRouter:
    """etag: a route class on this family's router, which no other route has."""
    routes = APIRouter(route_class=Tagged)

    @routes.get("/etag/small")
    async def small(response: Response) -> Payload:
        return fresh(response, p.small)

    @routes.get("/etag/large")
    async def large(response: Response) -> Payload:
        return fresh(response, p.large)

    return routes
