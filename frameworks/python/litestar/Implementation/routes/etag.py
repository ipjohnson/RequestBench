from hashlib import sha1

from litestar import Response, Router, get
from litestar.datastructures import Headers, MutableScopeHeaders
from litestar.enums import ScopeType
from litestar.middleware import ASGIMiddleware
from litestar.types import ASGIApp, HTTPResponseStartEvent, Message, Receive, Scope, Send

from payloads import Payload, Payloads
from serial import fresh


# rb:wiring etag.*
class Tagged(ASGIMiddleware):
    """Litestar computes no validator for a dynamic answer and never reads If-None-Match, so this
    family is wired by hand, as a middleware on this family's Router. It holds the answer's start
    until the body is complete, hashes the body with SHA-1, and answers 304 when If-None-Match
    already names the hash. The body is built and hashed before anything is compared, so a 304 saves
    the write and nothing else."""

    scopes = (ScopeType.HTTP,)

    async def handle(self, scope: Scope, receive: Receive, send: Send, next_app: ASGIApp) -> None:
        asked = named(Headers.from_scope(scope).get("if-none-match", ""))
        start: HTTPResponseStartEvent | None = None
        body = bytearray()

        async def tag(message: Message) -> None:
            nonlocal start
            if message["type"] == "http.response.start":
                start = message
                return
            if message["type"] != "http.response.body" or start is None:
                await send(message)
                return
            body.extend(message.get("body", b""))
            if message.get("more_body", False):
                return
            etag = f'"{sha1(body).hexdigest()}"'
            written = MutableScopeHeaders.from_message(start)
            written["etag"] = etag
            if etag in asked:
                start["status"] = 304
                del written["content-length"]
                del written["content-type"]
                await send(start)
                await send({"type": "http.response.body", "body": b""})
                return
            await send(start)
            await send({"type": "http.response.body", "body": bytes(body)})

        await next_app(scope, receive, tag)


def named(if_none_match: str) -> set[str]:
    """The tags an If-None-Match lists, compared weakly, so W/ is dropped from each."""
    return {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
# rb:end


def router(p: Payloads) -> Router:
    """etag: the middleware on this family's Router, which no other route has."""

    @get("/etag/small")
    async def small() -> Response[Payload]:
        return Response(p.small, headers=fresh())

    @get("/etag/large")
    async def large() -> Response[Payload]:
        return Response(p.large, headers=fresh())

    return Router(path="/", route_handlers=[small, large], middleware=[Tagged()])
