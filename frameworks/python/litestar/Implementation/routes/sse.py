from collections.abc import AsyncIterator

import msgspec
from litestar import Router, get
from litestar.response import ServerSentEvent

from payloads import Payloads


def router(p: Payloads) -> Router:
    """sse: items.medium's rows as server-sent events, through Litestar's ServerSentEvent. It writes
    what it is given as each event's data and serialises nothing itself, so each row is encoded by
    msgspec, as the json rows' are."""
    encode = msgspec.json.Encoder().encode

    async def events() -> AsyncIterator[bytes]:
        for row in p.medium.items:
            yield encode(row)

    @get("/sse/medium")
    async def medium() -> ServerSentEvent:
        return ServerSentEvent(events())

    return Router(path="/", route_handlers=[medium])
